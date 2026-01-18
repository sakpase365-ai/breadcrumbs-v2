import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import TypewriterText from "@/components/TypewriterText";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <h1 className="mb-4 text-6xl font-light text-foreground">
        <TypewriterText text="404" speed={0.2} showCursor={false} />
      </h1>
      <p className="mb-8 text-xl font-light text-muted-foreground">
        Page not found
      </p>
      <a 
        href="/" 
        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Return to Home
      </a>
    </div>
  );
};

export default NotFound;
