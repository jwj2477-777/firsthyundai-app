#!/usr/bin/env python3
"""Safe one-complex diagnostic for three already approved K-apt services.

The returned raw payload and private serviceKey are never printed, written to
repo or to logs. Only status, public field names and verified public numeric
fields are reported. Run in GitHub Actions with DATA_GO_KR_SERVICE_KEY.
"""
from __future__ import annotations
import os,re,sys
from collect_complexes import call_api,unpack,PublicApiError
from collect_registry_maintenance import fetch_basic,normalize_cost_response,FIELDS

SERVICES=[
 ("common","https://apis.data.go.kr/1613000/AptCmnuseManageCostServiceV3/",
  ["getHsmpLaborCostInfoV3","getHsmpGuardCostInfoV3","getHsmpCleaningCostInfoV3",
   "getHsmpEtcCostInfoV3","getHsmpDisinfectionCostInfoV3","getHsmpRepairsCostInfoV3",
   "getHsmpElevatorMntncCostInfoV3","getHsmpFacilityMntncCostInfoV3",
   "getHsmpSafetyCheckUpCostInfoV3","getHsmpConsignManageFeeInfoV3",
   "getHsmpDisasterPreventionCostInfoV3","getHsmpOfcrkCostInfoV3",
   "getHsmpTaxdueInfoV3","getHsmpHomeNetworkMntncCostInfoV3",
   "getHsmpVhcleMntncCostInfoV3","getHsmpClothingCostInfoV3"]),
 ("individual","https://apis.data.go.kr/1613000/AptIndvdlzManageCostServiceV3/",
  ["getHsmpHeatCostInfoV3","getHsmpWaterCostInfoV3","getHsmpElectricityCostInfoV3",
   "getHsmpHotWaterCostInfoV3","getHsmpGasRentalFeeInfoV3",
   "getHsmpWaterPurifierTankFeeInfoV3","getHsmpDomesticWasteFeeInfoV3",
   "getHsmpMovingInRepresentationMtgInfoV3","getHsmpBuildingInsuranceFeeInfoV3",
   "getHsmpElectionOrpnsInfoV3"]),
 ("reserve","https://apis.data.go.kr/1613000/AptRepairsCostServiceV3/",
  ["getHsmpMonthRetalFeeInfoV3","getHsmpMonthChargeAmtInfoV3",
   "getHsmpMonthChargeCostInfoV3","getHsmpMonthImposeAmtInfoV3"])
]
SAMPLE='A10026679'
def run(key):
 if not key:
  print('KAPT_THREE_API_KEY_MISSING');return 1
 try:
  basic=fetch_basic(key,SAMPLE)
  print('KAPT_BASE_IDENTITY',int(str(basic.get('kaptCode'))==SAMPLE),
    'doroJuso',int(bool(basic.get('doroJuso'))),
    'privArea',str(basic.get('privArea')),'kaptMarea',str(basic.get('kaptMarea')),'kaptTarea',str(basic.get('kaptTarea')),
    'fields',','.join(sorted(basic.keys())[:75]))
 except (PublicApiError,RuntimeError) as e:
  print('KAPT_BASE_STATUS',re.sub(r'[^a-zA-Z0-9가-힣 _-]','',str(e))[:95])
  return 2
 for month in ('202607',):
  for kind,base,ops in SERVICES:
   for op in ops:
    try:
     payload=call_api(base+op,{'kaptCode':SAMPLE,'searchDate':month,'dataType':'JSON'},key)
     rows,total=unpack(payload)
     if len(rows)>2:print('KAPT_API',month,kind,op,'rows',len(rows),'SKIP');continue
     keys=','.join(sorted(k for row in rows if isinstance(row,dict) for k in row.keys()))
     safevalues=[]
     for row in rows:
      for k,v in row.items():
       if any(t in k.lower() for t in ('cost','fee','pay','amount','sum','price','rate','total','area','month')):
        if re.fullmatch(r'[0-9]{1,15}(?:\\.[0-9]{1,6})?',str(v or '')):
         safevalues.append(k+'='+str(v))
     print('KAPT_API',month,kind,op,'rows',len(rows),'keys',keys[:850],
       'numeric',','.join(safevalues[:16])[:400])
    except (PublicApiError,RuntimeError) as e:
     detail=re.sub(r'[^a-zA-Z0-9가-힣 _=-]','',str(e))
     print('KAPT_API_ERROR',month,kind,op,detail[:105])
 return 0
if __name__=='__main__':
 sys.exit(run(os.environ.get('DATA_GO_KR_SERVICE_KEY','')))
