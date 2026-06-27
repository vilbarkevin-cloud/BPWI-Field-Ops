import { getAccessToken, googleSignIn } from './workspaceAuth';

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const exportToGoogleSheets = async (sheetName: string, dataRows: any[][], uid: string) => {
  let token = await getAccessToken();
  if (!token) {
    const res = await googleSignIn();
    if (!res) throw new Error('User not authenticated');
    token = res.accessToken;
  }

  let spreadsheetId = null;
  const settingsRef = doc(db, `users/${uid}/settings`, 'sheetsExport');
  const snap = await getDoc(settingsRef);
  
  if (snap.exists() && snap.data().spreadsheetId) {
    spreadsheetId = snap.data().spreadsheetId;
  }

  if (!spreadsheetId) {
    // Create a new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `WATSAN Export: ${sheetName}`,
        },
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error?.message || 'Failed to create sheet');
    spreadsheetId = createData.spreadsheetId;
    
    // Save to Firestore
    await setDoc(settingsRef, { spreadsheetId });
  }

  // Append data to the spreadsheet
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: dataRows,
      }),
    }
  );
  if (!updateRes.ok) {
     const updateData = await updateRes.json();
     throw new Error(updateData.error?.message || 'Failed to update sheet data');
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
};
