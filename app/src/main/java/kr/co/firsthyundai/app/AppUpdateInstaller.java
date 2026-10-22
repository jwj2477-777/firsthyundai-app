package kr.co.firsthyundai.app;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;

/**
 * Explicit, same-signature Android update installer. No customer or private data leaves the app.
 * Only the already-verified public GitHub release URL may be downloaded. The APK cannot be
 * offered to the system installer until both its package ID and signing certificate match the
 * installed app and its versionCode is strictly greater.
 */
final class AppUpdateInstaller {
    interface Status {void emit(String phase,int percent,String message);}
    static final long MAX_SIZE=80L*1024*1024;
    private AppUpdateInstaller(){}

    static File updateDirectory(Context context){
        File dir=new File(context.getCacheDir(),"verified_updates");
        if(!dir.isDirectory()&&!dir.mkdirs())throw new IllegalStateException("다운로드 폴더를 만들 수 없습니다.");
        return dir;
    }

    static File download(Context context,String verifiedUrl,Status report) throws Exception {
        if(!AppUpdate.allowedDownload(verifiedUrl))
            throw new IllegalArgumentException("정식 배포 파일 주소를 확인할 수 없습니다.");
        File dir=updateDirectory(context);
        // Never trust a filename supplied by the WebView or a redirect.
        String name=verifiedUrl.substring(verifiedUrl.lastIndexOf('/')+1);
        if(!name.matches("FirstHyundai-v[0-9]{1,3}(\\.[0-9]{1,3}){2}\\.apk"))
            throw new IllegalArgumentException("정식 APK 파일명이 아닙니다.");
        File temp=new File(dir,"download.partial");
        File finalApk=new File(dir,name);
        if(temp.exists())temp.delete();
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL(verifiedUrl).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(25000);
            connection.setRequestProperty("User-Agent","FirstHyundaiAndroidUpdater/1.0");
            connection.setInstanceFollowRedirects(true);
            int response=connection.getResponseCode();
            if(response!=200)throw new IllegalStateException("다운로드 서버 응답 "+response);
            if(!"https".equalsIgnoreCase(connection.getURL().getProtocol()))
                throw new SecurityException("안전하지 않은 다운로드 연결");
            String host=connection.getURL().getHost().toLowerCase(java.util.Locale.US);
            if(!("github.com".equals(host)||"release-assets.githubusercontent.com".equals(host)))
                throw new SecurityException("확인되지 않은 다운로드 제공처");
            long declared=connection.getContentLengthLong();
            if(declared>MAX_SIZE)throw new IllegalStateException("APK 크기가 허용 범위를 초과했습니다.");
            long count=0;
            int lastPercent=-1;
            try(InputStream input=connection.getInputStream();FileOutputStream out=new FileOutputStream(temp)){
                byte[] buf=new byte[16384];
                int read;
                while((read=input.read(buf))!=-1){
                    if(Thread.currentThread().isInterrupted())throw new InterruptedException("다운로드 중단");
                    count+=read;
                    if(count>MAX_SIZE)throw new IllegalStateException("APK 용량 한도 초과");
                    out.write(buf,0,read);
                    int percent=declared>0?(int)(100*count/declared):-1;
                    if(percent>=0&&(percent/5!=lastPercent/5||percent==100)){
                        lastPercent=percent;
                        report.emit("downloading",percent,"업데이트 파일 다운로드 중");
                    }
                }
                out.getFD().sync();
            }
            if(count<100000L||declared>0&&count!=declared)
                throw new IllegalStateException("다운로드가 불완전합니다.");
            report.emit("verifying",100,"APK 서명과 버전을 확인 중");
            verifyPackage(context,temp);
            if(finalApk.exists()&&!finalApk.delete())
                throw new IllegalStateException("이전 업데이트 파일을 정리할 수 없습니다.");
            if(!temp.renameTo(finalApk))throw new IllegalStateException("업데이트 파일을 저장할 수 없습니다.");
            return finalApk;
        }finally{
            if(connection!=null)connection.disconnect();
            if(temp.exists())temp.delete();
        }
    }

    @SuppressWarnings("deprecation")
    static void verifyPackage(Context context,File apk) throws Exception {
        PackageManager pm=context.getPackageManager();
        int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo archive=pm.getPackageArchiveInfo(apk.getAbsolutePath(),flags);
        PackageInfo current=pm.getPackageInfo(context.getPackageName(),flags);
        if(archive==null||archive.packageName==null||
           !context.getPackageName().equals(archive.packageName))
            throw new SecurityException("기존 퍼스트현대 앱과 패키지가 다릅니다.");
        long newBuild=Build.VERSION.SDK_INT>=28?archive.getLongVersionCode():archive.versionCode;
        long oldBuild=Build.VERSION.SDK_INT>=28?current.getLongVersionCode():current.versionCode;
        if(newBuild<=oldBuild)
            throw new SecurityException("현재 버전보다 높은 업데이트 파일이 아닙니다.");
        Signature[] a=signers(archive),b=signers(current);
        if(a.length==0||b.length==0||!Arrays.equals(a,b))
            throw new SecurityException("앱 서명키가 달라 설치를 중단했습니다.");
    }

    @SuppressWarnings("deprecation")
    private static Signature[] signers(PackageInfo info){
        if(Build.VERSION.SDK_INT>=28){
            if(info.signingInfo==null)return new Signature[0];
            Signature[] out=info.signingInfo.hasMultipleSigners()
                ?info.signingInfo.getApkContentsSigners()
                :info.signingInfo.getSigningCertificateHistory();
            return out==null?new Signature[0]:out;
        }
        return info.signatures==null?new Signature[0]:info.signatures;
    }

    static Uri shareUri(Context context,File apk){
        if(!apk.isFile()||!apk.getParentFile().equals(updateDirectory(context)))
            throw new SecurityException("검증된 앱 내부 APK만 설치합니다.");
        return FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",apk);
    }

    static JSONObject event(String phase,int percent,String message){
        JSONObject result=new JSONObject();
        try{
            result.put("phase",phase);
            result.put("percent",percent);
            result.put("message",message);
        }catch(Exception ignored){}
        return result;
    }
}
