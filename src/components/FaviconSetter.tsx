import { useEffect } from "react";

/**
 * Component that dynamically sets the favicon based on environment variables
 * This component should be included once in the app root
 */
const FaviconSetter: React.FC = () => {
    useEffect(() => {
        const appTitle = import.meta.env.VITE_APP_TITLE || "Block 52";
        document.title = appTitle;

        const faviconUrl = import.meta.env.VITE_FAVICON_URL || "/b52favicon.svg";
        
        // Update all favicon links
        const links = document.querySelectorAll("link[rel*=\"icon\"]");
        links.forEach((link) => {
            const linkElement = link as HTMLLinkElement;
            linkElement.href = faviconUrl;
        });
        
        // Also update apple-touch-icon and mask-icon if they exist
        const appleTouchIcon = document.querySelector("link[rel=\"apple-touch-icon\"]") as HTMLLinkElement;
        if (appleTouchIcon) {
            appleTouchIcon.href = faviconUrl;
        }
        
        const maskIcon = document.querySelector("link[rel=\"mask-icon\"]") as HTMLLinkElement;
        if (maskIcon) {
            maskIcon.href = faviconUrl;
        }
    }, []);

    // This component doesn't render anything visible
    return null;
};

export default FaviconSetter;