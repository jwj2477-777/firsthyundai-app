package kr.co.firsthyundai.app;

import org.json.JSONObject;
import java.util.Iterator;

/** Session-only note of user-explicit unresolved fields. Never writes the form,
 * customer records, audio, a bank account or server-side state.
 */
final class ContractLiveReview {
    static final String PENDING="pending";
    static final String DISCUSSION="discussion";
    static final String MANUAL="manual";
    static final String NOT_APPLICABLE="not_applicable";
    private static final String[] FIELDS={
        "property","unit","dealType","price","contractDeposit","contractDate",
        "advance","balanceDate","interim","interimDate","leaseStart","leaseEnd",
        "leaseDuration","monthlyRent","balanceTime","terms"
    };
    private static boolean isField(String key){
        for(String s:FIELDS)if(s.equals(key))return true;
        return false;
    }
    static boolean isStatus(String status){
        return PENDING.equals(status)||DISCUSSION.equals(status)||
            MANUAL.equals(status)||NOT_APPLICABLE.equals(status);
    }
    static boolean isStatusCall(JSONObject args){
        return args!=null&&(args.has("reviewField")||args.has("reviewStatus"));
    }
    /** Avoid model guessing values while presenting an unresolved field. */
    static String[] validate(JSONObject args) throws Exception {
        if(args==null||args.length()!=2||
           !(args.opt("reviewField") instanceof String)||
           !(args.opt("reviewStatus") instanceof String))throw new Exception("invalid review state");
        String field=args.optString("reviewField",""),state=args.optString("reviewStatus","");
        if(!isField(field)||!isStatus(state))throw new Exception("invalid review state");
        // Required deal terms cannot be marked inapplicable just to clear a checklist.
        if(NOT_APPLICABLE.equals(state)&&
           !("interim".equals(field)||"interimDate".equals(field)||
             "balanceTime".equals(field)||"terms".equals(field)))
            throw new Exception("required field cannot be skipped as not applicable");
        return new String[]{field,state};
    }
    static void record(JSONObject states,JSONObject known,String[] review) throws Exception {
        String field=review[0],state=review[1];
        if(known!=null&&known.has(field)&&!known.isNull(field)&&
           !String.valueOf(known.get(field)).trim().isEmpty())
            throw new Exception("already confirmed; require explicit corrected value");
        states.put(field,state);
    }
    static void clearResolved(JSONObject states,JSONObject changes){
        if(states==null||changes==null)return;
        Iterator<String> keys=changes.keys();
        while(keys.hasNext())states.remove(keys.next());
    }
    static JSONObject publicState(String field,String status) throws Exception {
        return new JSONObject().put("field",field).put("status",status);
    }
}
