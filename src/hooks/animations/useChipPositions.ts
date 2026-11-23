import { useState, useEffect, useRef } from "react";
import { chipPosition } from "../../utils/PositionArray";
import { useTableState } from "../game/useTableState";
import { ChipPositionsReturn, TableStateReturn, PositionArray } from "@block52/poker-ui-core/types";
import { hasElements } from "@block52/ui-sdk/helpers";

/**
 * Custom hook to manage chip positions based on table size
 * @param tableId The ID of the table
 * @param startIndex Optional starting index for reordering positions
 * @returns Object containing chip positions and utility functions
 */
export const useChipPositions = (startIndex: number = 0): ChipPositionsReturn => {
  const [chipPositionArray, setChipPositionArray] = useState<PositionArray[]>([]);
  const lastStartIndexRef = useRef<number>(startIndex);
  
  // Get table state to access tableSize
  const { tableSize }: TableStateReturn = useTableState();
  
  // Set initial chip positions based on table size
  useEffect(() => {
    if (!tableSize) return;
    
    let baseArray: PositionArray[];
    switch (tableSize) {
      case 6:
        baseArray = chipPosition.six;
        break;
      case 9:
        baseArray = chipPosition.nine;
        break;
      default:
        baseArray = [];
    }
    
    // Apply reordering if needed
    if (startIndex > 0 && hasElements(baseArray)) {
      const reorderedArray = [
        ...baseArray.slice(startIndex),
        ...baseArray.slice(0, startIndex)
      ];
      setChipPositionArray(reorderedArray);
    } else {
      setChipPositionArray(baseArray);
    }
    
    lastStartIndexRef.current = startIndex;
  }, [tableSize, startIndex]);
  
  return {
    chipPositionArray,
    tableSize
  };
}; 