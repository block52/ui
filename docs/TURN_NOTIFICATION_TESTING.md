# Turn Notification Feature - Manual Testing Guide

## Overview
The turn notification feature alerts players when it's their turn to act by:
1. **Flashing the browser tab favicon color** - The tab icon alternates between the original and a bright colored version using the app's color palette
2. **Playing an audible tone** - A pleasant two-note chime (A5 to C6)
3. **Auto-stopping** - Notifications stop when the user returns to the tab or their turn ends

**Note:** The tab title remains as "Block 52" at all times - only the favicon (tab icon) color changes to provide a visual notification.

## How to Test

### Prerequisites
1. Start the development server: `yarn dev` or `npm run dev`
2. Open two browser windows/tabs with the poker application
3. Join a game with both windows (simulating multiple players)

### Test Scenarios

#### Scenario 1: Favicon Color Flash When User's Turn Starts
1. Have your poker game open in **Tab A** and be seated at the table
2. Switch to **Tab B** (another tab/window)
3. Wait for it to be your turn in the game
4. **Expected Result**: 
   - Tab A's favicon (tab icon) should start flashing between:
     - Original favicon (Block 52 logo)
     - Colored square using the brand primary color (#3b82f6 by default)
   - The flashing should occur every 1 second (default interval)
   - **Tab title remains "Block 52" throughout**

#### Scenario 2: Audible Notification
1. Ensure your browser audio is enabled
2. Have the game open in a background tab
3. Wait for it to be your turn
4. **Expected Result**: 
   - You should hear a pleasant two-note chime (880 Hz → 1046.5 Hz)
   - Sound plays only once when your turn starts
   - Volume is set to 0.3 (30% of maximum)

#### Scenario 3: Notification Stops When Returning to Tab
1. Let the notification start (favicon flashing + sound)
2. Click on the poker game tab to bring it to focus
3. **Expected Result**:
   - Favicon immediately stops flashing
   - Favicon returns to original Block 52 logo
   - Tab title remains "Block 52"
   - No more notifications until your next turn

#### Scenario 4: Notification Stops When Turn Ends
1. Have notification running (tab is in background during your turn)
2. Let your turn time out or have someone else act
3. **Expected Result**:
   - Favicon stops flashing
   - Favicon returns to original
   - No sound plays

#### Scenario 5: No Notification When Tab is Active
1. Be on the poker game tab when it's your turn
2. **Expected Result**:
   - No favicon flashing occurs (you're already on the tab)
   - No sound plays
   - Game operates normally

### Configuration Options

The notification can be configured in `Table.tsx`:

```typescript
useTurnNotification(isCurrentUserTurn, {
    enableSound: true,        // Enable/disable sound
    soundVolume: 0.3,         // Volume level (0.0 to 1.0)
    flashInterval: 1000       // Milliseconds between favicon color changes
});
```

### Browser Compatibility

- **Chrome/Edge**: Full support for favicon flashing
- **Firefox**: Full support for favicon flashing
- **Safari**: Full support for favicon flashing
- **Mobile browsers**: Favicon flashing may have limited visibility due to OS tab management

### Troubleshooting

**Favicon not flashing?**
- Ensure `document.hidden` API is supported by your browser
- Check that the tab is actually in the background
- Verify `isCurrentUserTurn` is `true` in the game state
- Check browser console for any errors

**No sound?**
- Check browser audio permissions
- Some browsers block audio until user interaction
- Check console for any audio context errors
- Try adjusting `soundVolume` parameter

**Sound plays repeatedly?**
- This is intentional behavior if you navigate between tabs
- The sound plays once per turn start
- Return to the poker tab to stop notifications

## Code Structure

### Files Modified/Created
1. **`src/hooks/useTurnNotification.ts`** - Main notification hook
2. **`src/hooks/useTurnNotification.test.ts`** - Unit tests (11 tests)
3. **`src/components/playPage/Table.tsx`** - Integration point
4. **`src/setupTests.ts`** - Test configuration for import.meta mock

### Key Dependencies
- Uses existing `useNextToActInfo` hook for turn state
- Integrates with existing color palette from `colorConfig.ts`
- No external dependencies required (uses Web Audio API)
