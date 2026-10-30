package kr.co.firsthyundai.app;

import org.json.JSONObject;

/** Safe, actionable Live error labels. Never exposes tokens, keys, server bodies or client data. */
final class LiveFailureReason {
    private LiveFailureReason() {}

    private static String codeFor(int status,String responseBody){
        String code="";
        try{code=new JSONObject(responseBody).optString("error","");}
        catch(Exception ignored){}
        switch(code){
            case "daily_free_trial_limit":
            case "rate_limited":
            case "provider_quota":
            case "provider_access_denied":
            case "provider_model_unavailable":
            case "live_not_configured":
            case "account_session_required":
            case "office_auth_unavailable":
            case "live_provider_unavailable":
            case "live_token_invalid":
                return code;
            default:
                return status==429?"unknown_rate_limit":
                    status==401?"account_session_required":"server_unavailable";
        }
    }
    static String fromHttp(int status,String responseBody){
        return "FHD_LIVE_"+codeFor(status,responseBody);
    }
    static String display(Throwable failure){
        String reason=failure==null?"":String.valueOf(failure.getMessage());
        switch(reason){
            case "FHD_LIVE_daily_free_trial_limit":
                return "이 사무실 계정은 오늘 Live 6회 제한에 도달했습니다. 다음 UTC 날짜에 다시 이용하거나 기존 계약 메모를 사용해 주세요.";
            case "FHD_LIVE_rate_limited":
                return "짧은 시간에 Live 연결 요청이 많았습니다. 잠시 후 다시 시도해 주세요.";
            case "FHD_LIVE_provider_quota":
                return "Google Gemini Live API 사용 한도에 도달했습니다. Google AI Studio에서 무료 사용량을 확인해 주세요.";
            case "FHD_LIVE_provider_access_denied":
                return "Google Gemini Live 인증 또는 모델 이용 권한이 거절됐습니다. API 프로젝트 설정을 확인해 주세요.";
            case "FHD_LIVE_provider_model_unavailable":
                return "Google Live 모델 또는 요청 형식을 사용할 수 없습니다. 서버의 Live 모델 설정을 확인해 주세요.";
            case "FHD_LIVE_live_not_configured":
                return "사무실 서버에 Gemini Live API 키가 설정되지 않았습니다. 관리자가 서버 설정을 확인해 주세요.";
            case "FHD_LIVE_account_session_required":
                return "사무실 계정 인증이 필요합니다. 계정 연결 상태를 확인해 주세요.";
            case "FHD_LIVE_office_auth_unavailable":
                return "사무실 인증 서버 설정을 확인해야 합니다. 기존 계약 메모는 계속 사용할 수 있습니다.";
            case "FHD_LIVE_live_token_invalid":
                return "Google Live 인증 응답이 올바르지 않습니다. 서버 설정을 확인해 주세요.";
            case "FHD_LIVE_unknown_rate_limit":
                return "Live 요청이 제한됐습니다. 일일 6회 제한 또는 서버 요청량을 확인해 주세요.";
            case "FHD_LIVE_live_provider_unavailable":
                return "Google Live 인증 서버를 사용할 수 없습니다. 무료 한도·이용 권한·서비스 상태를 확인해 주세요.";
            default:
                return "Live 연결을 사용할 수 없습니다. 네트워크 또는 API 서버 상태를 확인해 주세요. 기존 메모는 계속 사용할 수 있습니다.";
        }
    }
    static String websocket(int httpStatus){
        if(httpStatus==429)return display(new Exception("FHD_LIVE_provider_quota"));
        if(httpStatus==401||httpStatus==403)return display(new Exception("FHD_LIVE_provider_access_denied"));
        return "Gemini Live 연결이 끊겼습니다. 네트워크 또는 제공자 서비스 상태를 확인해 주세요.";
    }
}
