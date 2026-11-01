package kr.co.firsthyundai.app;

/** Contract Live is strictly one voice turn at a time.
 * Only real model PCM output closes the microphone gate; turnComplete alone is
 * insufficient because generated audio may still be buffered on Android.
 * No speech, names, text or contract values are stored in this class.
 */
final class ContractLiveTurnGate {
    private boolean modelSpeaking=false;
    private boolean turnFinished=false;
    synchronized boolean microphoneAllowed(){return !modelSpeaking;}
    synchronized boolean modelAudioStarted(){
        boolean first=!modelSpeaking;
        modelSpeaking=true;
        turnFinished=false;
        return first;
    }
    synchronized void modelTurnComplete(){
        if(modelSpeaking)turnFinished=true;
    }
    synchronized boolean playbackFinished(){
        if(!modelSpeaking||!turnFinished)return false;
        modelSpeaking=false;
        turnFinished=false;
        return true;
    }
    synchronized void clear(){modelSpeaking=false;turnFinished=false;}
}
