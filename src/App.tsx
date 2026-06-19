import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Capture from "./pages/Capture";
import Archive from "./pages/Archive";
import Foundation from "./pages/Foundation";
import Landing from "./pages/Landing";
import GetStarted from "./pages/GetStarted";
import Auth from "./pages/Auth";
import CreatorDashboard from "./pages/creator/CreatorDashboard";
import CreatorProfile from "./pages/creator/CreatorProfile";
import ManageRecipients from "./pages/creator/ManageRecipients";
import CreateBreadcrumb from "./pages/creator/CreateBreadcrumb";
import CreatorPrompts from "./pages/creator/CreatorPrompts";
import CreatorProgress from "./pages/creator/CreatorProgress";
import JournalList from "./pages/creator/JournalList";
import JournalEntry from "./pages/creator/JournalEntry";
import RecipientHome from "./pages/recipient/RecipientHome";
import BreadcrumbDetail from "./pages/BreadcrumbDetail";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login-email" element={<Login />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/foundation" element={<Foundation />} />
          <Route path="/landing-legacy" element={<Landing />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/creator" element={<CreatorDashboard />} />
          <Route path="/creator/profile" element={<CreatorProfile />} />
          <Route path="/creator/recipients" element={<ManageRecipients />} />
          <Route path="/creator/create" element={<CreateBreadcrumb />} />
          <Route path="/creator/prompts" element={<CreatorPrompts />} />
          <Route path="/creator/progress" element={<CreatorProgress />} />
          <Route path="/creator/journal" element={<JournalList />} />
          <Route path="/creator/journal/:id" element={<JournalEntry />} />
          <Route path="/recipient" element={<RecipientHome />} />
          <Route path="/breadcrumb/:id" element={<BreadcrumbDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
