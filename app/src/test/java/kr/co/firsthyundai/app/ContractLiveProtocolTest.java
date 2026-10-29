package kr.co.firsthyundai.app;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
public class ContractLiveProtocolTest {
    private void reject(JSONObject value) throws Exception {
        try{ContractLiveProtocol.validated(value);fail("Must reject invalid or private fields");}
        catch(Exception expected){}
    }
    @Test public void onlyConditionFields() throws Exception {
        JSONObject result=ContractLiveProtocol.validated(new JSONObject().put("price",980000000)
            .put("interim",0).put("dealType","매매").put("balanceDate","2027-04-18"));
        assertEquals(980000000L,result.getLong("price"));
        assertEquals(0,result.getLong("interim"));
        for(String key:new String[]{"account","bank","owner","buyer","address","unit","rough","preview","__proto__"})
            reject(new JSONObject().put(key,"SYNTHETIC_PRIVATE_SENTINEL"));
    }
    @Test public void rejectMalformedAmountsAndText() throws Exception {
        reject(new JSONObject().put("price","980000000"));
        reject(new JSONObject().put("price",-1));
        reject(new JSONObject().put("price",0));
        reject(new JSONObject().put("price",1.5));
        reject(new JSONObject().put("price",1000000000001L));
        reject(new JSONObject().put("terms","<script>bad</script>"));
        reject(new JSONObject().put("terms",JSONObject.NULL));
        reject(new JSONObject().put("dealType","unknown"));
        reject(new JSONObject());
        reject(new JSONObject().put("balanceDate","2027-02-30"));
        reject(new JSONObject().put("balanceTime","25:00"));
        reject(new JSONObject().put("terms","예금주 직접 입력"));
        assertEquals("2028-02-29",ContractLiveProtocol.validated(new JSONObject().put("balanceDate","2028-02-29")).getString("balanceDate"));
        assertEquals("2027년 4월 중 협의",ContractLiveProtocol.validated(new JSONObject().put("contractDate","2027년 4월 중 협의")).getString("contractDate"));
    }
    @Test public void catchSessionAmountAndDateConflictsWithoutReadingForms() throws Exception {
        JSONObject prior=new JSONObject().put("price",900000000L).put("contractDeposit",90000000L)
            .put("contractDate","2027-01-10");
        ContractLiveProtocol.validateConsistency(prior,new JSONObject().put("interim",100000000L)
            .put("advance",50000000L).put("balanceDate","2027-04-10"));
        for(JSONObject bad:new JSONObject[]{
            new JSONObject().put("contractDeposit",990000000L),
            new JSONObject().put("advance",95000000L),
            new JSONObject().put("interim",850000001L),
            new JSONObject().put("balanceDate","2027-01-09")}) {
            try{ContractLiveProtocol.validateConsistency(prior,bad);fail("Must catch conflicting amounts or dates");}
            catch(Exception expected){}
        }
        ContractLiveProtocol.validateConsistency(new JSONObject().put("leaseStart","2027-01-01"),
            new JSONObject().put("leaseEnd","2027-12-31"));
        try{ContractLiveProtocol.validateConsistency(new JSONObject().put("leaseStart","2027-12-31"),
            new JSONObject().put("leaseEnd","2027-01-01"));fail("Reversed lease dates");}
        catch(Exception expected){}
        // Do not invent a date relation for "to be agreed" wording.
        ContractLiveProtocol.validateConsistency(new JSONObject().put("contractDate","2027년 1월 중 협의"),
            new JSONObject().put("balanceDate","2027-01-01"));
    }
    @Test public void toolsCannotReadFormsOrExecuteSharing() throws Exception {
        JSONObject tool=ContractLiveProtocol.tools().getJSONObject(0).getJSONArray("functionDeclarations").getJSONObject(0);
        assertEquals(ContractLiveProtocol.FUNCTION,tool.getString("name"));
        JSONObject fields=tool.getJSONObject("parameters").getJSONObject("properties");
        assertEquals(14,fields.length());
        for(String k:new String[]{"account","bank","address","owner","buyer","send","save","rough"})assertFalse(fields.has(k));
        assertTrue(ContractLiveProtocol.prompt().contains("기존 메모나 계약 입력란은 볼 수 없습니다"));
    }
}
