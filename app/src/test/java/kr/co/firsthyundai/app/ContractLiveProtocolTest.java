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
        for(String key:new String[]{"account","bank","owner","buyer","address","rough","preview","__proto__"})
            reject(new JSONObject().put(key,"SYNTHETIC_PRIVATE_SENTINEL"));
    }
    @Test public void apartmentNameAndBuildingUnitAreRequiredVoiceEligibleFields() throws Exception {
        JSONObject result=ContractLiveProtocol.validated(new JSONObject()
            .put("property","파크애비뉴").put("unit","1604 동 2101 호")
            .put("dealType","매매").put("price",1440000000L));
        assertEquals("파크애비뉴",result.getString("property"));
        assertEquals("1604동 2101호",result.getString("unit"));
        JSONObject metadata=ContractLiveProtocol.tools().getJSONObject(0)
            .getJSONArray("functionDeclarations").getJSONObject(0)
            .getJSONObject("parameters").getJSONObject("properties");
        assertTrue(metadata.has("property"));
        assertTrue(metadata.has("unit"));
        assertTrue(ContractLiveProtocol.prompt().contains("필수 거래 대상 정보"));
        for(String bad:new String[]{"1604동","2101호","1604동 0호","0동 2101호",
            "1604동 2101호 고객전화 010-1234-5678","010-1234-5678"}){
            reject(new JSONObject().put("unit",bad));
        }
        for(String bad:new String[]{"01012345678","010-1234-5678","고객 계좌 11111",
            "인천광역시 송도동 123-45",""}){
            reject(new JSONObject().put("property",bad));
        }
        for(String key:new String[]{"bank","account","accountHolder","owner","buyer","phone","address"}){
            reject(new JSONObject().put(key,"SYNTHETIC_PRIVATE"));
        }
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
    @Test public void yearlessCalendarDatesMustNotBecomePastYear() throws Exception {
        java.time.LocalDate today=java.time.LocalDate.of(2026,10,31);
        for(String date:new String[]{"2026-03-25","2026-07-30","2026-10-30"}){
            try{
                ContractLiveProtocol.validated(new JSONObject().put("balanceDate",date),today);
                fail("Past date must require explicit correction: "+date);
            }catch(ContractLiveProtocol.PastContractDateException expected){}
        }
        for(String date:new String[]{"2027-03-25","2027-07-30","2026-10-31","2028-02-29"}){
            assertEquals(date,ContractLiveProtocol.validated(
                new JSONObject().put("balanceDate",date),today).getString("balanceDate"));
        }
        try{
            ContractLiveProtocol.validated(new JSONObject().put("contractDate","2026-03-25"),today);
            fail("Contract dates must also be checked");
        }catch(ContractLiveProtocol.PastContractDateException expected){}
        JSONObject tentative=ContractLiveProtocol.validated(
            new JSONObject().put("contractDate","2027년 1월 말 협의"),today);
        assertTrue(tentative.getString("contractDate").contains("협의"));
        // A user may still enter an explicitly historical contract in the manual form.
        // The voice tool must not silently roll a named past year forward.
        assertTrue(ContractLiveProtocol.prompt().contains("가장 가까운 날짜"));
        assertTrue(ContractLiveProtocol.prompt().contains("rejected_past_date"));
    }
    @Test public void toolsCannotReadFormsOrExecuteSharing() throws Exception {
        JSONObject tool=ContractLiveProtocol.tools().getJSONObject(0).getJSONArray("functionDeclarations").getJSONObject(0);
        assertEquals(ContractLiveProtocol.FUNCTION,tool.getString("name"));
        JSONObject fields=tool.getJSONObject("parameters").getJSONObject("properties");
        assertEquals(16,fields.length());
        for(String k:new String[]{"account","bank","address","owner","buyer","send","save","rough"})assertFalse(fields.has(k));
        assertTrue(ContractLiveProtocol.prompt().contains("기존 메모나 계약 입력란은 볼 수 없습니다"));
    }
}
