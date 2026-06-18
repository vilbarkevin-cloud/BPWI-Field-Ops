import React, { forwardRef } from 'react';

export interface MeterTestData {
  account: string;
  date: string;
  projectAddress: string;
  natureOfTest: string;
  paymentDetails?: string;
  meterBrand: string;
  volumeOfWater: number; // usually 30 liters in the screenshot, or whatever
  natureOfMeter: string; // Old, New
  reading1_init: number;
  reading1_final: number;
  reading2_init: number;
  reading2_final: number;
  reading3_init: number;
  reading3_final: number;
  error1: number;
  error2: number;
  error3: number;
  avgError: number;
  testingResults: string; // Fast Moving, Slow Moving, Passed
  recommendation: string; // Replace, Retain
  testedBy: string;
  witnessedBy: string;
  checkedBy: string;
  finalDecision: string; // Proceed, Override: Retain, RETEST
}

export const PrintableMeterTest = forwardRef<HTMLDivElement, { data: MeterTestData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white text-black max-w-4xl mx-auto font-sans text-sm printable-meter-test border border-gray-200 print:border-none my-8">
      <div className="flex items-center gap-4 border-b-2 border-black pb-4 mb-4">
        <div className="w-24 h-24 bg-blue-500 text-white flex items-center justify-center font-bold text-xl rounded">
           <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.05 13.5a11.96 11.96 0 0 1 19.9 0"></path><path d="M7.74 18.26a6 6 0 0 1 8.52 0"></path><circle cx="12" cy="12" r="2"></circle>
           </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold">BP Waterworks, Inc.</h1>
          <p>Unit 3B-5B, 2nd Floor, 5J's Commercial Bldg., Zone 7</p>
          <p>Road 8, Don Julio Subd., Brgy. Aganan, Pavia, Iloilo</p>
          <p>Tel. (0905)300-4368 / 338-2853</p>
        </div>
      </div>
      
      <h2 className="text-center font-bold text-lg mb-4 underline uppercase">WATERMETER TEST RESULTS</h2>

      <table className="w-full border-collapse border border-black mb-4">
        <tbody>
          <tr>
            <td className="border border-black p-2 w-1/4 font-semibold">Account:</td>
            <td className="border border-black p-2 w-1/4 bg-[#FFF2CC]">{data.account}</td>
            <td className="border border-black p-2 w-1/4 font-semibold">Date:</td>
            <td className="border border-black p-2 w-1/4 text-right">{data.date}</td>
          </tr>
          <tr>
            <td className="border border-black p-2" colSpan={2} rowSpan={2}>
              <span className="font-semibold block mb-1">Project/Address:</span>
              <div className="text-center mt-2">{data.projectAddress}</div>
            </td>
            <td className="border border-black p-2 font-semibold">Nature of Test:</td>
            <td className="border border-black p-2 text-center">{data.natureOfTest}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 align-top h-20" colSpan={2} rowSpan={4}>
              <span className="font-semibold block mb-1">Comments:</span>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Payment Details:</td>
            <td className="border border-black p-2">{data.paymentDetails}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Meter Brand:</td>
            <td className="border border-black p-2 text-center">{data.meterBrand}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Volume of Water:</td>
            <td className="border border-black p-2 text-center">{data.volumeOfWater} liters</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Nature of Meter:</td>
            <td className="border border-black p-2 text-center">{data.natureOfMeter}</td>
            <td className="border border-black p-2 font-semibold align-top h-24" colSpan={2} rowSpan={2}>
              Witnessed by:
              <div className="mt-8 text-center italic border-b border-black w-3/4 mx-auto pb-1">{data.witnessedBy}</div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-0" colSpan={2}>
              <table className="w-full h-full text-center">
                <thead>
                  <tr className="bg-[#9BC2E6]">
                    <th colSpan={3} className="border-b border-black p-1 font-semibold">Normal Flow</th>
                  </tr>
                  <tr>
                    <th colSpan={2} className="border-b border-black p-1 font-semibold border-r">Reading</th>
                    <th className="border-b border-black p-1 font-semibold">% Error</th>
                  </tr>
                  <tr>
                    <th className="border-b border-black p-1 font-semibold border-r w-1/3">Initial</th>
                    <th className="border-b border-black p-1 font-semibold border-r w-1/3">Final</th>
                    <th className="border-b border-black p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                     <td className="border-b border-black p-1 border-r">{data.reading1_init > 0 ? data.reading1_init.toFixed(4) : ''}</td>
                     <td className="border-b border-black p-1 border-r">{data.reading1_final > 0 ? data.reading1_final.toFixed(4) : ''}</td>
                     <td className={`border-b border-black p-1 font-bold ${Math.abs(data.error1) > 5 ? 'text-red-500' : ''}`}>{data.error1 > 0 ? '+' : ''}{data.error1.toFixed(2)}%</td>
                  </tr>
                  <tr>
                     <td className="border-b border-black p-1 border-r">{data.reading2_init > 0 ? data.reading2_init.toFixed(4) : ''}</td>
                     <td className="border-b border-black p-1 border-r">{data.reading2_final > 0 ? data.reading2_final.toFixed(4) : ''}</td>
                     <td className={`border-b border-black p-1 font-bold ${Math.abs(data.error2) > 5 ? 'text-red-500' : ''}`}>{data.error2 > 0 ? '+' : ''}{data.error2.toFixed(2)}%</td>
                  </tr>
                  <tr>
                     <td className="border-b border-black p-1 border-r">{data.reading3_init > 0 ? data.reading3_init.toFixed(4) : ''}</td>
                     <td className="border-b border-black p-1 border-r">{data.reading3_final > 0 ? data.reading3_final.toFixed(4) : ''}</td>
                     <td className={`border-b border-black p-1 font-bold ${Math.abs(data.error3) > 5 ? 'text-red-500' : ''}`}>{data.error3 > 0 ? '+' : ''}{data.error3.toFixed(2)}%</td>
                  </tr>
                  <tr>
                     <td colSpan={2} className="border-r border-black p-1 bg-gray-50"></td>
                     <td className={`p-1 font-bold ${Math.abs(data.avgError) > 5 ? 'text-red-500' : ''}`}>{data.avgError > 0 ? '+' : ''}{data.avgError.toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold" colSpan={2}>
              Checked by:
              <div className="mt-8 text-center uppercase tracking-wider">{data.checkedBy || 'HERNAN TALAVERA'}</div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Testing Results:</td>
            <td className="border border-black p-2 text-center font-bold">{data.testingResults}</td>
            <td className="border border-black p-2 font-semibold" colSpan={2} rowSpan={3}>
              Final Decision
              <div className="mt-2 space-y-1 ml-4">
                 <label className="flex flex-row items-center gap-2"><div className={`w-4 h-4 border border-black flex items-center justify-center`}>{data.finalDecision === 'Proceed' ? '✓' : ''}</div> Proceed</label>
                 <label className="flex flex-row items-center gap-2"><div className={`w-4 h-4 border border-black flex items-center justify-center`}>{data.finalDecision === 'Override: Retain' ? '✓' : ''}</div> Override: Retain</label>
                 <label className="flex flex-row items-center gap-2"><div className={`w-4 h-4 border border-black flex items-center justify-center`}>{data.finalDecision === 'RETEST' ? '✓' : ''}</div> RETEST</label>
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">Recommendation:</td>
            <td className="border border-black p-2 text-center font-bold">{data.recommendation}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold align-top h-16">Tested by:</td>
            <td className="border border-black p-2 text-center align-middle">{data.testedBy}</td>
          </tr>
        </tbody>
      </table>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-meter-test, .printable-meter-test * {
            visibility: visible;
          }
          .printable-meter-test {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .text-red-500 {
            color: #ef4444 !important;
          }
          .bg-\\[\\#FFF2CC\\] {
            background-color: #FFF2CC !important;
            -webkit-print-color-adjust: exact;
          }
          .bg-\\[\\#9BC2E6\\] {
            background-color: #9BC2E6 !important;
            -webkit-print-color-adjust: exact;
          }
        }
      `}} />
    </div>
  );
});
