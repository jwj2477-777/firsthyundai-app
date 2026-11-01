package kr.co.firsthyundai.app;

import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import static org.junit.Assert.*;

public class ContractLiveChecklistTest {
 @Test public void onlyUndisclosedContractFieldsAreAsked(){
  JSONObject p=new JSONObject().put("property","파크애비뉴").put("unit","1604동 2101호")
   .put("dealType","매매").put("price",1440000000L).put("contractDeposit",144000000L)
   .put("contractDate","2026-11-01").put("advance",144000000L).put("balanceDate","2027-07-30");
  JSONArray missing=ContractLiveChecklist.missing(p);
  assertEquals(0,missing.length());
  JSONObject info=ContractLiveChecklist.reminder(p);
  assertEquals(0,info.getInt("missing_count"));
  assertTrue(info.getBoolean("completion_requires_explicit_user_approval"));
  assertTrue(info.getBoolean("await_user_reply"));
 }
 @Test public void nextQuestionFollowsActualKnownFieldsNotAnAiGuess(){
  JSONObject partial=new JSONObject().put("property","퍼스트파크 15블럭");
  JSONArray missing=ContractLiveChecklist.missing(partial);
  assertEquals("unit",missing.getString(0));
  JSONObject details=ContractLiveChecklist.reminder(partial);
  assertEquals("unit",details.getString("next_missing"));
  String json=details.toString();
  assertFalse(json.contains("퍼스트파크")); // Never return contract values to model.
  assertFalse(json.contains("계좌"));
  assertFalse(json.contains("고객"));
 }
 @Test public void saleVersusRentalAndConditionalInterim(){
  JSONObject p=new JSONObject().put("dealType","월세")
     .put("interim",20000000).put("leaseStart","2027-01-05");
  String all=ContractLiveChecklist.missing(p).toString();
  assertTrue(all.contains("monthlyRent"));
  assertTrue(all.contains("leaseDuration"));
  assertTrue(all.contains("interimDate"));
  p.put("dealType","매매").put("interim",0);
  String sale=ContractLiveChecklist.missing(p).toString();
  assertFalse(sale.contains("monthlyRent"));
  assertFalse(sale.contains("leaseDuration"));
  assertFalse(sale.contains("interimDate"));
 }
}
