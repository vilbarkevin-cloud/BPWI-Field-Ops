import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export function generateActivityPDF(activity: any) {
  const doc = new jsPDF();
  const dateStr = format(new Date(activity.date || activity.timestamp || Date.now()), "yyyy-MM-dd");

  // Title
  doc.setFontSize(20);
  doc.text("Activity Report", 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 14, 30);

  // Main Details Table
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Activity Details", 14, 45);

  const flatDetails = [
    ["Activity ID", activity.id || "N/A"],
    ["Type", activity.type || activity.title || "N/A"],
    ["Area/Facility", activity.area || activity.siteOrWell || "N/A"],
    ["Status", (activity.status || "N/A").toUpperCase()],
    ["Staff", Array.isArray(activity.staff) ? activity.staff.join(", ") : (activity.operator || activity.staff || "N/A")],
    ["Notes", activity.notes || "None"]
  ];

  if (activity.details) {
    Object.keys(activity.details).forEach(k => {
      const v = activity.details[k];
      if (v !== undefined && v !== null && v !== "") {
        flatDetails.push([k, String(v)]);
      }
    });
  }

  autoTable(doc, {
    startY: 50,
    head: [["Field", "Value"]],
    body: flatDetails,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`Activity_Report_${activity.id || dateStr}.pdf`);
}

export function generateDailyDigestPDF(tasks: any[], activities: any[], handovers: any[]) {
  const doc = new jsPDF();
  const dateStr = format(new Date(), "yyyy-MM-dd");

  // Title
  doc.setFontSize(20);
  doc.text("Daily Digest Report", 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 14, 30);

  // Summary logic
  const todayTasks = tasks; // Assuming all tasks belong to current scope, or we could filter by date
  const completedTasks = todayTasks.filter(t => t.status === "completed").length;
  
  // Basic Stats
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Executive Summary", 14, 45);
  
  doc.setFontSize(11);
  doc.text(`Total Tasks: ${todayTasks.length}`, 14, 53);
  doc.text(`Completed Tasks: ${completedTasks}`, 14, 59);
  doc.text(`Pending Tasks: ${todayTasks.length - completedTasks}`, 14, 65);

  let currentY = 75;

  // Activities Table
  if (activities && activities.length > 0) {
    doc.setFontSize(14);
    doc.text("Recent Activities", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [["Activity Type", "Area", "Status", "Date"]],
      body: activities.slice(0, 20).map(a => [
        a.title || a.type || "N/A",
        a.area || a.location || "N/A",
        a.status || "N/A",
        a.date || "N/A"
      ]),
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Tasks Table
  if (tasks && tasks.length > 0) {
    doc.setFontSize(14);
    doc.text("Recent Tasks", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [["Task Title", "Location", "Priority", "Status", "Assigned To"]],
      body: tasks.slice(0, 20).map(t => [
        t.title || "N/A",
        t.location || "N/A",
        t.priority || "N/A",
        t.status || "pending",
        t.assignedTo || "Unassigned"
      ]),
      theme: "grid",
      headStyles: { fillColor: [39, 174, 96] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Incidents/Handovers Table
  if (handovers && handovers.length > 0) {
    doc.setFontSize(14);
    doc.text("Handovers / Incidents", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [["Issue", "Priority", "Status", "Notes"]],
      body: handovers.slice(0, 20).map(h => [
        h.title || h.issue || "N/A",
        h.priority || "N/A",
        h.status || "N/A",
        (h.notes || "").slice(0, 50) + "..."
      ]),
      theme: "grid",
      headStyles: { fillColor: [231, 76, 60] },
    });
  }

  doc.save(`Daily_Digest_${dateStr}.pdf`);
}
