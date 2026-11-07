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
        return missing(proposals,new JSONObject());
    }
    static JSONArray missing(JSONObject proposals,JSONObject deferred){
        JSONObject p=proposals==null?new JSONObject():proposals;
        JSONObject states=deferred==null?new JSONObject():deferred;
        JSONArray missing=new JSONArray();
        for(String name:COMMON)if(!present(p,name)&&!states.has(name))missing.put(name);
        String type=p.optString("dealType","");
        if(("전세".equals(type)||"월세".equals(type))){
            if(!present(p,"leaseStart")&&!states.has("leaseStart"))missing.put("leaseStart");
            if(!present(p,"leaseDuration")&&!present(p,"leaseEnd")&&
                !states.has("leaseDuration")&&!states.has("leaseEnd"))missing.put("leaseDuration");
        }
        if("월세".equals(type)&&!present(p,"monthlyRent")&&!states.has("monthlyRent"))
            missing.put("monthlyRent");
        if(p.optLong("interim",0)>0&&!present(p,"interimDate")&&!states.has("interimDate"))
            missing.put("interimDate");
        if(p.optLong("interim2",0)>0&&!present(p,"interimDate2")&&!states.has("interimDate2"))
            missing.put("interimDate2");
        return missing;
    }
    private static boolean present(JSONObject p,String name){
        if(!p.has(name)||p.isNull(name))return false;
        String s=String.valueOf(p.opt(name)).trim();
        return !s.isEmpty();
    }
    static JSONObject reminder(JSONObject proposals) throws org.json.JSONException{
        return reminder(proposals,new JSONObject());
    }
    static JSONObject reminder(JSONObject proposals,JSONObject deferred) throws org.json.JSONException{
        JSONArray missing=missing(proposals,deferred);
        JSONObject p=proposals==null?new JSONObject():proposals;
        JSONObject states=deferred==null?new JSONObject():deferred;
        JSONObject result=new JSONObject();
        result.put("missing_count",missing.length());
        result.put("next_missing",missing.length()>0?missing.optString(0):"");
        result.put("confirmed_count",p.length());
        result.put("deferred_count",states.length());
        // A deferred term is STILL unresolved; zero unanswered prompts does not
        // mean a valid/complete contract and does not constitute user approval.
        result.put("all_required_confirmed",missing.length()==0&&states.length()==0);
        result.put("await_user_reply",true);
        result.put("completion_requires_explicit_user_approval",true);
        return result;
    }
}
