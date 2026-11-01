package kr.co.firsthyundai.app;

import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class ContractLiveReviewTest {
 @Test public void unresolvedConditionsAreNeverInvented() throws Exception {
  JSONObject states=new JSONObject(),known=new JSONObject().put("property","퍼스트파크 15블럭");
  String[] review=ContractLiveReview.validate(
     new JSONObject().put("reviewField","balanceDate").put("reviewStatus","discussion"));
  ContractLiveReview.record(states,known,review);
  assertEquals("discussion",states.getString("balanceDate"));
  assertFalse(known.has("balanceDate"));
  JSONObject response=ContractLiveChecklist.reminder(known,states);
  assertEquals("unit",response.getString("next_missing"));
  assertEquals(1,response.getInt("deferred_count"));
  String responseText=response.toString();
  assertFalse(responseText.contains("퍼스트파크"));
  assertFalse(responseText.contains("계좌"));
  assertTrue(response.getBoolean("completion_requires_explicit_user_approval"));
  ContractLiveReview.clearResolved(states,new JSONObject().put("balanceDate","2027-04-18"));
  assertFalse(states.has("balanceDate"));
 }
 @Test public void statusesOnlyOnWhitelistedFieldsAndMandatoryCannotBeNotApplicable() throws Exception {
  for(String badField:new String[]{"bank","account","accountHolder","customer","address","owner"}){
    try{ContractLiveReview.validate(new JSONObject().put("reviewField",badField)
         .put("reviewStatus","manual"));fail(badField);}catch(Exception expected){}
  }
  for(String badStatus:new String[]{"confirmed","", "user_sent_account","automatic"}){
    try{ContractLiveReview.validate(new JSONObject().put("reviewField","unit")
         .put("reviewStatus",badStatus));fail(badStatus);}catch(Exception expected){}
  }
  try{ContractLiveReview.validate(new JSONObject().put("reviewField","price")
      .put("reviewStatus","not_applicable"));fail("required field");}catch(Exception expected){}
  assertEquals("not_applicable",ContractLiveReview.validate(new JSONObject()
      .put("reviewField","interim").put("reviewStatus","not_applicable"))[1]);
  try{ContractLiveReview.validate(new JSONObject().put("reviewField","unit")
      .put("reviewStatus","manual").put("price",123L));fail("mixed");}catch(Exception expected){}
 }
 @Test public void knownValuesCannotBeSilentlyOverwrittenBySkip() throws Exception {
  JSONObject states=new JSONObject();
  JSONObject known=new JSONObject().put("price",1500000000L);
  try{ContractLiveReview.record(states,known,new String[]{"price","pending"});fail("known");
  }catch(Exception expected){}
  assertFalse(states.has("price"));assertEquals(1500000000L,known.getLong("price"));
 }
}
