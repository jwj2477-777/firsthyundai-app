package kr.co.firsthyundai.app;

/** Contract Live is strictly one voice turn at a time.
 * Model output transcription may arrive before PCM: gate the mic immediately
 * to prevent the opening syllables from returning to Gemini as user speech.
 * Still keep the gate shut until turnComplete AND speaker playback drain.
 * No speech, names, text or contract values are stored in this class.
 */
final class ContractLiveTurnGate {
    private boolean modelSpeaking=false;
    private boolean audioStarted=false;
    private boolean turnFinished=false;
    // A delayed output transcript after playback must not mute the next reply.
    private boolean waitingForUser=false;
    synchronized boolean microphoneAllowed(){return !modelSpeaking;}
    synchronized void userSpeechDetected(){waitingForUser=false;}
    synchronized void modelOutputAnnounced(){
        if(waitingForUser)return;
        if(!modelSpeaking){
            modelSpeaking=true;
            audioStarted=false;
            turnFinished=false;
        }
    }
    synchronized boolean modelAudioStarted(){
        boolean first=!audioStarted;
        modelSpeaking=true;
        waitingForUser=false;
        audioStarted=true;
        turnFinished=false;
        return first;
    }
    synchronized void modelTurnComplete(){
        if(modelSpeaking)turnFinished=true;
    }
    synchronized boolean playbackFinished(){
        if(!modelSpeaking||!turnFinished)return false;
        modelSpeaking=false;
        audioStarted=false;
        turnFinished=false;
        waitingForUser=true;
        return true;
    }
    synchronized void clear(){modelSpeaking=false;audioStarted=false;turnFinished=false;waitingForUser=false;}
}
