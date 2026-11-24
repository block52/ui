import React from "react";
import { useNetwork } from "../context/NetworkContext";
import { PokerActionPanel } from "./Footer/PokerActionPanel";
import "./Footer.css";
import { useTableId } from "../hooks/game/useTableId";

interface FooterProps {
    onTransactionSubmitted?: (txHash: string | null) => void;
}

const Footer: React.FC<FooterProps> = ({ onTransactionSubmitted }) => {
    const tableId = useTableId();
    const { currentNetwork } = useNetwork();

    if (!tableId) return null;

    return (
        <PokerActionPanel
            tableId={tableId}
            network={currentNetwork}
            onTransactionSubmitted={onTransactionSubmitted}
        />
    );
};

export default Footer;
