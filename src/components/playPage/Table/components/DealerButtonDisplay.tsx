import * as React from "react";
import { getDealerImageUrl } from "../../../../utils/cardImages";
import { dealerButtonSizeForViewport } from "../../../../utils/chipSize";
import "./DealerButtonDisplay.css";

interface DealerButtonDisplayProps {
    /** Which side of the bet group the button sits on. */
    side: "left" | "right";
}

/**
 * The dealer button, drawn beside the button seat's bet group (ui#835) so it
 * always sits on the felt directly in front of the dealer, whichever seat that
 * is. Sized 20% larger than one chip.
 */
const DealerButtonDisplay: React.FC<DealerButtonDisplayProps> = ({ side }) => {
    const size = dealerButtonSizeForViewport();
    return (
        <div className="dealer-button" data-dealer-side={side} style={{ width: size, height: size }} data-testid="dealer-button">
            <img src={getDealerImageUrl()} alt="Dealer Button" />
        </div>
    );
};

export default DealerButtonDisplay;
