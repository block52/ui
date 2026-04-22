import { useNavigate } from "react-router-dom";
import styles from "./ClickableAddress.module.css";
import { isNullish } from "../../utils/guards";

interface ClickableAddressProps {
    address: string;
    className?: string;
    showFull?: boolean;
}

/**
 * Clickable address component that links to the address explorer page
 * Detects Cosmos addresses (starting with b52) and makes them clickable
 */
export const ClickableAddress: React.FC<ClickableAddressProps> = ({ address, className = "", showFull = false }) => {
    const navigate = useNavigate();

    // Check if it's a valid Cosmos address (starts with b52)
    const isCosmosAddress = address && address.startsWith("b52");

    if (!isCosmosAddress) {
        return <span className={className}>{address}</span>;
    }

    const displayAddress = showFull ? address : `${address.substring(0, 10)}...${address.substring(address.length - 6)}`;

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/explorer/address/${address}`);
    };

    return (
        <span
            onClick={handleClick}
            className={`cursor-pointer hover:underline transition-colors ${styles.addressLink} ${className}`}
            title={`View address ${address}`}
        >
            {displayAddress}
        </span>
    );
};

/**
 * Recursively renders JSON with clickable addresses
 * Detects any string that looks like a Cosmos address and makes it clickable
 */
export const renderJSONWithClickableAddresses = (obj: unknown, depth = 0): React.ReactElement => {
    if (isNullish(obj)) {
        return <span className="text-gray-500">null</span>;
    }

    if (typeof obj === "string") {
        // Check if it's a Cosmos address
        if (obj.startsWith("b52") && obj.length > 20) {
            return <ClickableAddress address={obj} />;
        }
        return <span className="text-green-400">&quot;{obj}&quot;</span>;
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
        return <span className="text-blue-400">{String(obj)}</span>;
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return <span>[]</span>;
        }
        return (
            <span>
                [
                <div style={{ paddingLeft: `${depth + 1}rem` }}>
                    {obj.map((item: unknown, index: number) => (
                        <div key={index}>
                            {renderJSONWithClickableAddresses(item, depth + 1)}
                            {index < obj.length - 1 && <span>,</span>}
                        </div>
                    ))}
                </div>
                ]
            </span>
        );
    }

    if (typeof obj === "object") {
        const entries = Object.entries(obj as Record<string, unknown>);
        if (entries.length === 0) {
            return <span>{"{}"}</span>;
        }
        return (
            <span>
                {"{"}
                <div style={{ paddingLeft: `${depth + 1}rem` }}>
                    {entries.map(([key, value], index) => (
                        <div key={key}>
                            <span className="text-purple-400">&quot;{key}&quot;</span>
                            <span>: </span>
                            {renderJSONWithClickableAddresses(value, depth + 1)}
                            {index < entries.length - 1 && <span>,</span>}
                        </div>
                    ))}
                </div>
                {"}"}
            </span>
        );
    }

    return <span>{String(obj)}</span>;
};
