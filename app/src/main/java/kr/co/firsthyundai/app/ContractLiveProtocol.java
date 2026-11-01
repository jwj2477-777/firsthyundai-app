package kr.co.firsthyundai.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.ZoneId;

/** No access to Activity, form contents, storage, customer data or credentials. */
final class ContractLiveProtocol {
    static final String FUNCTION="propose_contract_conditions";
    static final String[] MONEY={"price","contractDeposit","advance","interim","monthlyRent"};
    static final String[] DATES={"contractDate","interimDate","balanceDate","leaseStart","leaseEnd"};
    static final String[] TEXT={"dealType","property","unit","leaseDuration","balanceTime","terms"};
    private static boolean contains(String[] list,String key){for(String s:list)if(s.equals(key))return true;return false;}
    static String prompt(){
        return "당신은 퍼스트현대의 선택형 계약조건 음성 작성 도우미입니다. 한국어 존댓말로 짧게 대화하세요. "
            +"엄격한 순서제 대화입니다: ① 사용자가 한 번에 말한 계약 정보를 끝까지 듣고 빠뜨리지 않고 정리하세요. "
            +"② 이미 들은 정보는 다시 묻지 마세요. ③ 빠진 항목은 단 한 가지씩 짧게 질문하세요. "
            +"④ AI가 한 번 말할 때는 확인 문장 최대 한 문장과 질문 한 가지만 말하고 즉시 발화를 끝내세요. "
            +"사용자 음성 입력이 없는 상태에서 새로운 AI 발화를 연이어 시작하지 마세요. "
            +"질문 끝에 반드시 멈추세요. 실제 사용자 답변이 새로 들어오기 전에는 혼자 답하거나, 
            +"스스로 사용자 역할을 연기하거나, 두 번째 질문을 이어 하거나, 빈칸을 상상해서 채우지 마세요. "
            +"질문 뒤에는 침묵하며 기다리세요. 답변을 받았을 때에만 다음 미확인 항목을 확인하세요. "
            +"한 질문에 대한 답이 '미정·모름·나중에 직접 입력·해당 없음·협의 중'이면 만들어 채우거나 강요하지 말고 미확인으로 표시해 두고 다음 조건으로 넘어가세요. "
            +"이때 다른 금액·날짜와 섞지 않고 도구에 reviewField와 reviewStatus만 별도 전송하세요. "
            +"reviewStatus는 미정=pending, 협의 중=discussion, 직접 입력=manual, 해당 없음=not_applicable입니다. "
            +"실제 사용자가 그렇게 말한 항목에만 표시하세요. 이미 값을 확정한 항목을 임의로 미정으로 바꾸지 마세요. "
            +"거래에 필수인 단지명·동호수·거래금액·계약금·계약일·잔금일 등을 해당 없음으로 취급하지 마세요. "
            +"나중에 사용자가 확정된 값을 새로 말하면 일반 계약조건 제안으로 다시 보내 상태를 해제하세요. "
            +"모든 조건이 확인돼도 사용자가 '완료' 또는 '이대로 진행' 등 확실한 종료 의사를 보이거나 "
            +"앱의 '종료하고 확인'을 누르기 전에는 일방적으로 완료를 선언하거나 종료하지 마세요. "
            +"계약 조건 확인을 마쳤다면 '빠진 내용은 직접 작성하실 수 있습니다. 이대로 완료하실까요?'처럼 한 번만 물은 뒤 기다리세요. "
            +"사용자가 완료 의사를 밝히면 조건 변경을 검토 후보로 남기고, 앱에서 직접 '종료하고 확인'을 눌러야 한다고 안내하세요. "
            +"현재 한국 날짜는 "+LocalDate.now(ZoneId.of("Asia/Seoul"))+"입니다. 다음 규칙을 반드시 지키세요: " 
            +"사용자가 연도를 말하지 않고 월일만 말했다면 오늘보다 뒤에 있는 가장 가까운 날짜를 선택하세요. "
            +"예를 들어 오늘이 2026-10-31이면 '3월 25일'은 2027-03-25, '7월 30일'은 2027-07-30입니다. "
            +"오늘보다 이른 날짜를 올해 날짜로 쓰지 마세요. 이듬해를 의미하는지 확실하지 않다면 연도를 짧게 되물으세요. "
            +"연도를 명시했는데 이미 지난 날짜라면 임의로 내년으로 변경하지 말고 확인하세요. "
            +"기존 메모나 계약 입력란은 볼 수 없습니다. "
            +"사용자가 이번 대화에서 명시한 단지명(property), 동·호수(unit), 거래유형, 금액, 지급일, 입주일, 기간, 특약을 정리하세요. "
            +"단지명과 동·호수는 필수 거래 대상 정보입니다. 개인정보라는 이유로 거절하지 마세요. "
            +"예: '송도 파크애비뉴 1604동 2101호' → property='파크애비뉴', unit='1604동 2101호'. "
            +"'동·호수'를 말씀하시면 숫자를 한 번만 또박또박 읽어 확인하세요. 단지명·동·호수를 임의로 만들지 마세요. "
            +"고객 이름, 전화번호, 상세 지번·도로명주소, 은행, 계좌, 예금주, 비밀번호, 기밀은 묻거나 도구에 넣지 마세요. "
            +"그런 정보가 나오면 반복하지 말고 음성을 종료한 뒤 직접 입력하도록 안내하세요. "
            +"금액과 날짜가 불명확하면 한 번에 하나씩 되물으세요. 연도 없는 월일은 가까운 미래로 해석하되 "
            +"연도·날짜를 정확한 연월일로 읽어 다시 확인하세요. 지난 날짜를 도구로 보내면 거절됩니다. "
            +"이번 대화에서 빠진 단지명, 동·호수, 거래유형, 총액, 계약금, 이번 송금액, 계약일, 잔금일을 하나씩 질문하세요. "
            +"중도금이 있으면 금액과 지급일을, 전월세면 기간과 입주일을, 월세면 월 차임도 확인하세요. "
            +"특약은 필요한지 묻되 없으면 만들지 마세요. 모른다/미정/나중에 직접 입력하겠다는 답이면 강요하지 말고 미확정으로 남기세요. "
            +"앞선 금액/날짜와 충돌하는 새 발언은 변경 의도를 되묻고 확인 후 제안하세요. "
            +"실제 합의의 진위를 알 수 없으므로 정확성을 보증하지 마세요. 앱에서도 필수항목과 계산을 검사합니다. "
            +"새 의무, 위약금, 합의, 법적 효력을 만들거나 단정하지 마세요. 사용자가 말한 특약의 의미를 보존하세요. "
            +"조건을 듣거나 수정할 때마다 "+FUNCTION+" 도구로 해당 변경 항목만 제안하세요. "
            +"도구 응답 dialogue.next_missing은 이번 대화에서 아직 답을 받지도 미정 상태로 남겨두지도 않은 다음 확인 항목입니다. "
            +"dialogue.deferred_count는 사용자가 직접 미정·협의 중·직접 입력 등으로 남긴 항목 수입니다. "
            +"dialogue.missing_count가 0이어도 deferred_count가 양수면 확정 완료가 아닙니다. "
            +"미정인 항목이 남아 있으면 이를 짧게 요약하고 나중에 직접 확인하도록 안내한 뒤 사용자 완료 사인을 기다리세요. "
            +"이미 들은 값이나 사용자가 명시적으로 미정·직접 입력하겠다고 한 내용은 반복해서 묻지 마세요. "
            +"dialogue.await_user_reply=true이면 질문 한 번 후 바로 멈춰 실제 사용자 답변을 기다리세요. "
            +"dialogue.missing_count=0이어도 완료 의사를 추측하거나 임의로 종료하지 마세요. "
            +"도구 응답에 항목명만 있어도 사용자가 말하지 않은 실제 계약 값은 만들어서는 안 됩니다. "
            +"금액은 원 단위 정수입니다. 말하지 않은 항목은 생략하세요. 계약금 10% 등 계산 결과를 임의 확정하지 마세요. "
            +"도구 결과가 rejected_invalid_fields이면 반영됐다고 말하지 말고 잘못된 형식이나 불명확한 항목을 다시 확인하세요. "
            +"도구 결과가 rejected_inconsistent_conditions이면 거래 총액/계약금/이번 송금액/중도금 또는 날짜 순서가 충돌한 것입니다. 반영됐다고 말하지 말고 한 번에 한 항목씩 확인하여 서로 맞는 조건을 함께 다시 제안하세요. "
            +"도구 결과가 rejected_past_date이면 과거 연도 제안이 거절된 것입니다. 사용자에게 실제 의도한 연도를 물어 확인하고, 미래 날짜로 확정한 뒤 다시 제안하세요. 과거 날짜를 반복해서 보내지 마세요. "
            +"중도금 없다는 말은 interim=0, interimDate=빈 문자열로 제안하세요. "
            +"특약 변경 시 이번 대화에서 정리한 특약 전체를 terms로 보내세요. "
            +"도구는 화면의 검토 후보만 만들며 실제 계약 저장/공유는 하지 않습니다. "
            +"사용자가 완료라 하면 도구 반영 후 '종료하고 확인'을 누르도록 안내하세요.";
    }
    static JSONArray tools() throws Exception {
        JSONObject properties=new JSONObject();
        for(String k:MONEY)properties.put(k,new JSONObject().put("type","INTEGER")
            .put("description",k+": 사용자가 명시한 원 단위 금액. 불명확하면 생략."));
        for(String k:DATES)properties.put(k,new JSONObject().put("type","STRING")
            .put("description",k+": 확인한 YYYY-MM-DD. contractDate/interimDate만 협의 문구 허용. 삭제는 빈 문자열."));
        properties.put("dealType",new JSONObject().put("type","STRING").put("enum",new JSONArray().put("매매").put("전세").put("월세")));
        properties.put("property",new JSONObject().put("type","STRING").put("description",
            "아파트 단지명만. 예: 퍼스트파크 15블럭 또는 파크애비뉴. 고객명·계좌·상세 주소는 제외."));
        properties.put("unit",new JSONObject().put("type","STRING").put("description",
            "계약 대상 동·호수, 정확히 '1604동 2101호' 형식. 동과 호가 모두 확인된 경우에만 제안."));
        properties.put("leaseDuration",new JSONObject().put("type","STRING").put("description","임대차 기간, 예: 2년 또는 24개월"));
        properties.put("balanceTime",new JSONObject().put("type","STRING").put("description","확인한 잔금 시간 HH:mm"));
        properties.put("terms",new JSONObject().put("type","STRING").put("description","이번 대화의 특약 전체. 개인정보 제외, 사용자 발언 의미 보존, 한 줄 한 항목."));
        properties.put("reviewField",new JSONObject().put("type","STRING")
            .put("enum",new JSONArray().put("property").put("unit").put("dealType")
              .put("price").put("contractDeposit").put("contractDate").put("advance")
              .put("balanceDate").put("interim").put("interimDate").put("leaseStart")
              .put("leaseEnd").put("leaseDuration").put("monthlyRent")
              .put("balanceTime").put("terms"))
            .put("description","이번 음성 대화 중 사용자 명시적으로 미정/협의/직접입력/해당없음이라 답한 항목만. reviewStatus와 둘만 묶어 제안."));
        properties.put("reviewStatus",new JSONObject().put("type","STRING")
            .put("enum",new JSONArray().put("pending").put("discussion")
               .put("manual").put("not_applicable"))
            .put("description","사용자가 명시한 미확정 상태: pending 미정, discussion 협의 중, manual 직접 입력, not_applicable 해당 없음(선택항목만). 정확한 값 제안과 동시에 사용하지 말 것."));
        return new JSONArray().put(new JSONObject().put("functionDeclarations",new JSONArray().put(new JSONObject()
            .put("name",FUNCTION).put("description","사용자가 말한 계약조건을 검토 후보로 제안. 저장/승인/발송 아님.")
            .put("parameters",new JSONObject().put("type","OBJECT").put("properties",properties)))));
    }
    private static boolean validDate(String value){
        if(!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))return false;
        try{LocalDate d=LocalDate.parse(value);return d.getYear()>=2000&&d.getYear()<=2100;}
        catch(Exception ignored){return false;}
    }
    /** Contract preview must not silently accept past years when spoken year is ambiguous.
     * If the caller explicitly wants a historical contract, use the original manual form.
     * The clock is injectable for rollover/leap-year tests.
     */
    static class PastContractDateException extends Exception {
        PastContractDateException(){super("rejected_past_date");}
    }
    static JSONObject validated(JSONObject args,LocalDate today) throws Exception {
        return validateFields(args,today);
    }
        /** Validates cumulative proposals made in this voice session only. Never reads a form. */
    static void validateConsistency(JSONObject previous,JSONObject change) throws Exception {
        JSONObject merged=new JSONObject(previous==null?"{}":previous.toString());
        java.util.Iterator<String> keys=change.keys();
        while(keys.hasNext()){String key=keys.next();merged.put(key,change.get(key));}
        long total=merged.has("price")?merged.getLong("price"):-1;
        long deposit=merged.has("contractDeposit")?merged.getLong("contractDeposit"):-1;
        long advance=merged.has("advance")?merged.getLong("advance"):-1;
        long interim=merged.has("interim")?merged.getLong("interim"):-1;
        if(total>=0&&deposit>=0&&deposit>total)throw new Exception("deposit exceeds total");
        if(deposit>=0&&advance>=0&&advance>deposit)throw new Exception("advance exceeds deposit");
        if(total>=0&&interim>=0&&interim>total)throw new Exception("interim exceeds total");
        if(total>=0&&deposit>=0&&interim>=0&&deposit+interim>total)throw new Exception("scheduled payments exceed total");
        for(String[] pair:new String[][]{{"contractDate","balanceDate"},{"leaseStart","leaseEnd"}}){
            String start=merged.optString(pair[0],"");
            String end=merged.optString(pair[1],"");
            if(validDate(start)&&validDate(end)&&LocalDate.parse(start).isAfter(LocalDate.parse(end)))
                throw new Exception("reversed dates");
        }
    }
    static JSONObject validated(JSONObject args) throws Exception {
        return validateFields(args,LocalDate.now(ZoneId.of("Asia/Seoul")));
    }
    private static JSONObject validateFields(JSONObject args,LocalDate today) throws Exception {
        if(today==null)throw new IllegalArgumentException("today required");
        if(args==null||args.length()==0||args.toString().length()>6500)throw new Exception("invalid proposal");
        JSONObject result=new JSONObject();
        java.util.Iterator<String> keys=args.keys();
        while(keys.hasNext()){
            String k=keys.next();Object value=args.get(k);
            if(contains(MONEY,k)){
                if(!(value instanceof Number))throw new Exception("invalid amount");
                double n=((Number)value).doubleValue();
                if(!Double.isFinite(n)||n<0||n>1_000_000_000_000L||n!=Math.rint(n)
                    ||(n==0&&!k.equals("interim")&&!k.equals("monthlyRent")))throw new Exception("invalid amount");
                result.put(k,(long)n);
            }else if(contains(DATES,k)||contains(TEXT,k)){
                if(!(value instanceof String))throw new Exception("invalid text");
                String s=((String)value).trim();
                if(s.length()>(k.equals("terms")?4000:100)||s.indexOf('<')>=0||s.indexOf('>')>=0)throw new Exception("invalid text");
                if(k.equals("dealType")&&!s.matches("매매|전세|월세"))throw new Exception("invalid type");
                if(k.equals("property")){
                    // Apartment names may contain block numbers, but not personal contacts or full addresses.
                    if(s.length()<2||!s.matches("[가-힣A-Za-z0-9\\s().·ㆍ&+/-]{2,100}")||
                        (!java.util.regex.Pattern.compile("[가-힣A-Za-z]").matcher(s).find())||
                        java.util.regex.Pattern.compile("광역시|특별시|도로명주소|주소\\s*[:：]").matcher(s).find())
                        throw new Exception("invalid apartment name");
                }
                if(k.equals("unit")){
                    java.util.regex.Matcher unit=java.util.regex.Pattern.compile(
                        "^([0-9]{1,4})\\s*동\\s*([0-9]{1,4})\\s*호$").matcher(s);
                    if(!unit.matches()||Integer.parseInt(unit.group(1))<1||Integer.parseInt(unit.group(2))<1)
                        throw new Exception("invalid building and unit");
                    s=unit.group(1)+"동 "+unit.group(2)+"호";
                }
                if(contains(DATES,k)&&validDate(s)&&LocalDate.parse(s).isBefore(today))
                    throw new PastContractDateException();
                if(contains(DATES,k)&&!s.isEmpty()&&!validDate(s)){
                    if(!(k.equals("contractDate")||k.equals("interimDate"))
                        ||!s.matches("[0-9\\s년월일초중말순경~～.\\-/협의추후미정예정상호결정까지부터전후사이]+")
                        ||!java.util.regex.Pattern.compile("협의|미정|추후|초순|중순|하순|월말|월초|전후|사이|~|～").matcher(s).find())
                        throw new Exception("invalid date");
                }
                if(k.equals("leaseDuration")&&!s.isEmpty()&&!s.matches("[0-9]{1,3}\\s*(?:년|개월)(?:\\s*[0-9]{1,2}\\s*개월)?"))throw new Exception("invalid duration");
                if(k.equals("balanceTime")&&!s.isEmpty()&&!s.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]"))throw new Exception("invalid time");
                if(java.util.regex.Pattern.compile("계좌|예금주|주민등록|전화번호|연락처|비밀번호|은행|[0-9]{2,4}-[0-9]{3,4}-[0-9]{4}|[0-9]{10,}").matcher(s).find())throw new Exception("private text");
                result.put(k,s);
            }else throw new Exception("field not allowed");
        }
        return result;
    }
}
