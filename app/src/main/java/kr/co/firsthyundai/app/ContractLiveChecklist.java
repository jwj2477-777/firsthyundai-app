package kr.co.firsthyundai.app;

import org.json.JSONArray;
import org.json.JSONObject;

/** Deterministic, session-only contract checklist. It never reads existing
 * forms or personal account fields and never asserts that a transaction is final.
 */
final class ContractLiveChecklist {
    private static final String[] COMMON={"property","unit","dealType","price",
        "contractDeposit","contractDate","advance","balanceDate"};
    static JSONArray missing(JSONObject proposals){
        JSONObject p=proposals==null?new JSONObject():proposals;
        JSONArray missing=new JSONArray();
        for(String name:COMMON)if(!present(p,name))missing.put(name);
        String type=p.optString("dealType","");
        if(("전세".equals(type)||"월세".equals(type))){
            if(!present(p,"leaseStart"))missing.put("leaseStart");
            if(!present(p,"leaseDuration")&&!present(p,"leaseEnd"))missing.put("leaseDuration");
        }
        if("월세".equals(type)&&!present(p,"monthlyRent"))missing.put("monthlyRent");
        if(p.optLong("interim",0)>0&&!present(p,"interimDate"))missing.put("interimDate");
        return missing;
    }
    private static boolean present(JSONObject p,String name){
        if(!p.has(name)||p.isNull(name))return false;
        String s=String.valueOf(p.opt(name)).trim();
        return !s.isEmpty();
    }
    static JSONObject reminder(JSONObject proposals){
        JSONArray missing=missing(proposals);
        JSONObject result=new JSONObject();
        result.put("missing_count",missing.length());
        result.put("next_missing",missing.length()>0?missing.optString(0):"");
        // This is guidance for ONE question; it is not a completion or approval.
        result.put("await_user_reply",true);
        result.put("completion_requires_explicit_user_approval",true);
        return result;
    }
}
