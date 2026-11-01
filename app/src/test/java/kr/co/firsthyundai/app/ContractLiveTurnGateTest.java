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
