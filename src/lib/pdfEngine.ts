// These imports must be available with the application's initial module graph.
// A long-lived tab must not request a removed, lazy PDF chunk after deployment.
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export { html2canvas, jsPDF }
