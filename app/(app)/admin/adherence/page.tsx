import { getAdherenceData, getEmployees } from './AdherenceData';
import AdherenceManagement from './AdherenceManagement';

export default async function AdherencePage() {
  // Fetch data server-side
  const { recentUpdates, statistics } = await getAdherenceData();
  const employees = await getEmployees();
  
  return (
    <AdherenceManagement 
      initialRecentUpdates={recentUpdates} 
      initialStatistics={statistics}
      employees={employees}
    />
  );
}
