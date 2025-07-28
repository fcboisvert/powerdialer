import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "@/pages/Login";
import AppSelector from "./AppSelector";
import PowerDialer from "./PowerDialer";
import CallWebhookHandler from "./CallWebhookHandler";
import MeetingTranscriber from "./MeetingTranscriber"; // Add this import

export default function App() {
  return (
    <BrowserRouter>
      <CallWebhookHandler />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/select" element={<AppSelector />} />
        <Route path="/powerdialer" element={<PowerDialer />} />
        <Route path="/meeting-transcriber" element={<MeetingTranscriber />} /> {/* Add this route */}
      </Routes>
    </BrowserRouter>
  );
}
