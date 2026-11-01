package kr.co.firsthyundai.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class ContractLiveTurnGateTest {
 @Test public void noMicrophoneFeedbackWhileAiSpeaksOrAudioRemains(){
  ContractLiveTurnGate gate=new ContractLiveTurnGate();
  assertTrue(gate.microphoneAllowed());
  assertTrue(gate.modelAudioStarted());
  assertFalse(gate.microphoneAllowed());
  assertFalse(gate.modelAudioStarted()); // Multiple PCM chunks are the same voice turn.
  assertFalse(gate.playbackFinished()); // Audio cannot unblock before turnComplete.
  gate.modelTurnComplete();
  assertFalse(gate.microphoneAllowed()); // Google turn completed but speaker is still talking.
  assertTrue(gate.playbackFinished());
  assertTrue(gate.microphoneAllowed());
  assertFalse(gate.playbackFinished()); // Idempotent.
 }
 @Test public void transcriptBeforePcmBlocksEchoAndReopensOnlyAfterPlayback(){
  ContractLiveTurnGate gate=new ContractLiveTurnGate();
  assertTrue(gate.microphoneAllowed());
  gate.modelOutputAnnounced(); // Google may send output text before first PCM.
  assertFalse(gate.microphoneAllowed());
  gate.modelOutputAnnounced(); // Partial transcript must not unlock or restart the turn.
  assertTrue(gate.modelAudioStarted()); // First real sound still emits "AI speaking".
  assertFalse(gate.modelAudioStarted());
  gate.modelTurnComplete();
  assertFalse(gate.microphoneAllowed());
  assertTrue(gate.playbackFinished());
  assertTrue(gate.microphoneAllowed());
 }
 @Test public void transcriptOnlyTurnCannotPermanentlyMuteInput(){
  ContractLiveTurnGate gate=new ContractLiveTurnGate();
  gate.modelOutputAnnounced();
  assertFalse(gate.microphoneAllowed());
  gate.modelTurnComplete();
  // With no PCM, the playback task can reopen immediately after turn completion.
  assertTrue(gate.playbackFinished());
  assertTrue(gate.microphoneAllowed());
  gate.modelAudioStarted();
  gate.clear();assertTrue(gate.microphoneAllowed());
 }
 @Test public void lateTranscriptionAfterFinishedPlaybackCannotStallMicrophone(){
  ContractLiveTurnGate gate=new ContractLiveTurnGate();
  gate.modelAudioStarted();
  gate.modelTurnComplete();
  assertTrue(gate.playbackFinished());
  assertTrue(gate.microphoneAllowed());
  gate.modelOutputAnnounced(); // Trailing transcription from the finished AI reply.
  assertTrue(gate.microphoneAllowed());
  gate.userSpeechDetected(); // Next actual user turn is transcribed.
  gate.modelOutputAnnounced();
  assertFalse(gate.microphoneAllowed());
  gate.modelTurnComplete();
  assertTrue(gate.playbackFinished()); // Transcription-only response still recovers.
 }
 @Test public void reconnectAndNewModelOutputNeverManufactureUserSpeech(){
  ContractLiveTurnGate gate=new ContractLiveTurnGate();
  gate.modelTurnComplete(); // No actual AI speech yet.
  assertTrue(gate.microphoneAllowed());
  gate.modelAudioStarted();
  gate.modelTurnComplete();
  gate.modelAudioStarted(); // New output before old playback completion.
  assertFalse(gate.playbackFinished());
  assertFalse(gate.microphoneAllowed());
  gate.clear();assertTrue(gate.microphoneAllowed());
 }
}
