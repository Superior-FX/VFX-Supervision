import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Capture from "./pages/Capture.jsx";
import CaptureReports from "./pages/CaptureReports.jsx";
import ScriptBreakdown from "./pages/ScriptBreakdown.jsx";
import ScriptReports from "./pages/ScriptReports.jsx";
import ShotBoard from "./pages/ShotBoard.jsx";
import ShotDetail from "./pages/ShotDetail.jsx";
import PostReports from "./pages/PostReports.jsx";
import Review from "./pages/Review.jsx";
import Upload from "./pages/Upload.jsx";
import ArtistReport from "./pages/ArtistReport.jsx";
import Help from "./pages/Help.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />

      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/capture-reports" element={<CaptureReports />} />
        <Route path="/breakdown" element={<ScriptBreakdown />} />
        <Route path="/script-reports" element={<ScriptReports />} />
        <Route path="/board" element={<ShotBoard />} />
        <Route path="/post-reports" element={<PostReports />} />
        <Route path="/shot/:shotId" element={<ShotDetail />} />
        <Route path="/review" element={<Review />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/artist-report" element={<ArtistReport />} />
        <Route path="/help" element={<Help />} />
      </Route>
    </Routes>
  );
}
