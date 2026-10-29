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
    @Test public void toolsCannotReadFormsOrExecuteSharing() throws Exception {
        JSONObject tool=ContractLiveProtocol.tools().getJSONObject(0).getJSONArray("functionDeclarations").getJSONObject(0);
        assertEquals(ContractLiveProtocol.FUNCTION,tool.getString("name"));
        JSONObject fields=tool.getJSONObject("parameters").getJSONObject("properties");
        assertEquals(14,fields.length());
        for(String k:new String[]{"account","bank","address","owner","buyer","send","save","rough"})assertFalse(fields.has(k));
        assertTrue(ContractLiveProtocol.prompt().contains("기존 메모나 계약 입력란은 볼 수 없습니다"));
    }
}
