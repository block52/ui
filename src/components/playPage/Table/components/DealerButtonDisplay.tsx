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
const DealerButtonDisplay: React.FC<DealerButtonDisplayProps> = React.memo(({ side }) => {
    const size = dealerButtonSizeForViewport();
    const style = React.useMemo(() => ({ width: size, height: size }), [size]);
    return (
        <div className="dealer-button" data-dealer-side={side} style={style} data-testid="dealer-button">
            <img src={getDealerImageUrl()} alt="Dealer Button" />
        </div>
    );
});
DealerButtonDisplay.displayName = "DealerButtonDisplay";

export default DealerButtonDisplay;
