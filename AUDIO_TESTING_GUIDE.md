# Audio Streaming Testing Guide for Debate Room

## Overview

This guide will help you test the audio streaming functionality to ensure users can talk to each other in the debate room before implementing video streaming.

## Prerequisites

1. ✅ Development server is running on http://localhost:3001
2. ✅ Supabase database is configured
3. ✅ User authentication is working
4. ✅ Room creation/joining is working

## Step-by-Step Testing Process

### Phase 1: Basic Access Testing

#### 1. Create a Test Room

```bash
# Navigate to: http://localhost:3001/dashboard
# Click "Create New Room"
# Fill in room details:
- Title: "Audio Test Debate"
- Topic: "Testing audio streaming"
- Mode: "Classic"
- Max Participants: 4
- Duration: 30 minutes
- Turn Duration: 2 minutes
- Rounds: 3
```

#### 2. Get Multiple Test Users

You'll need at least 2 users to test audio streaming:

**Option A: Use Multiple Browsers**

- Chrome (Host)
- Firefox (Participant 1)
- Edge (Participant 2)

**Option B: Use Incognito/Private Windows**

- Chrome Regular (Host)
- Chrome Incognito (Participant 1)
- Firefox Private (Participant 2)

#### 3. Join the Room

```bash
# For each browser/user:
1. Go to http://localhost:3001
2. Login with different user accounts
3. Join the same room using the room code
4. Set role as "debater" for participants who will speak
```

### Phase 2: Pre-Debate Testing

#### 4. Room Lobby Testing

```bash
# Check in the waiting room:
✓ Can see all participants
✓ Ready system works
✓ Chat messages work
✓ Host can start debate
```

#### 5. Access Debate Room

```bash
# When host starts debate:
1. All participants should be redirected to /room/[id]/debate
2. Check for any console errors (F12 → Console)
3. Verify Jitsi Meet iframe loads properly
```

### Phase 3: Audio Streaming Testing

#### 6. Jitsi Meet Loading

Check the following in browser console:

```javascript
// Expected console messages:
"Jitsi Meet is ready"
"Participant joined: [participant info]"

// Check for errors:
- No 404 errors for Jitsi scripts
- No CORS errors
- No initialization errors
```

#### 7. Audio Permissions Testing

```bash
# For each participant:
1. Browser should ask for microphone permission
2. Grant microphone access
3. Check microphone icon in Jitsi toolbar
4. Verify audio settings in Jitsi (gear icon → Audio settings)
```

#### 8. Audio Streaming Test

```bash
# Test Procedure:
1. Host speaks → Others should hear
2. Participant 1 speaks → Others should hear
3. Participant 2 speaks → Others should hear
4. Test muting/unmuting
5. Test volume levels
6. Test with different speakers taking turns
```

### Phase 4: Debate-Specific Audio Testing

#### 9. Turn Management with Audio

```bash
# Test debate flow:
1. Check turn indicator shows current speaker
2. Current speaker unmutes to speak
3. Others remain muted (or mute themselves)
4. Host advances turn
5. Next speaker gets turn indication
6. Audio switches properly between speakers
```

#### 10. Chat Integration with Audio

```bash
# Test chat during audio streaming:
1. Send chat messages while someone is speaking
2. Verify chat doesn't interfere with audio
3. Test system messages (turn changes, etc.)
4. Check if chat notifications work during audio calls
```

## Debugging Common Issues

### Issue 1: Jitsi Not Loading

```bash
# Check Console for:
- 404 error for https://8x8.vc/libs/external_api.min.js
- CORS errors
- "JitsiMeetExternalAPI is not defined"

# Solutions:
1. Check internet connection
2. Try different Jitsi domain (meet.jit.si instead of 8x8.vc)
3. Clear browser cache
```

### Issue 2: No Audio Permission

```bash
# Check:
- Browser microphone permissions
- System audio settings
- Microphone hardware

# Solutions:
1. Reset browser permissions
2. Try different browser
3. Check system audio devices
```

### Issue 3: Can't Hear Other Participants

```bash
# Check:
- Speaker/headphone connection
- Browser audio settings
- Jitsi audio settings
- System volume levels

# Test:
1. Play other audio (YouTube, etc.)
2. Check Jitsi audio test in settings
3. Try headphones instead of speakers
```

### Issue 4: Audio Quality Issues

```bash
# Common Problems:
- Echo (use headphones)
- Background noise (mute when not speaking)
- Low volume (check system/Jitsi settings)
- Choppy audio (check internet connection)
```

## Expected Audio Flow in Debate

### Normal Debate Audio Flow:

1. **Opening Phase**: Each debater speaks in turn (2 minutes each)
2. **Rebuttal Phase**: Debaters respond to each other (1.5 minutes each)
3. **Closing Phase**: Final statements (2 minutes each)

### Audio Controls Expected:

- ✅ Microphone mute/unmute
- ✅ Speaker volume control
- ✅ Audio device selection
- ✅ Audio quality indicator
- ✅ Push-to-talk (optional)

## Testing Checklist

### Before Starting Tests:

- [ ] Server running on http://localhost:3001
- [ ] Multiple browsers/users ready
- [ ] Microphones/headphones available
- [ ] Quiet testing environment

### Basic Functionality:

- [ ] Room creation works
- [ ] Multiple users can join
- [ ] Jitsi iframe loads without errors
- [ ] Microphone permissions granted

### Audio Streaming:

- [ ] Can hear host speaking
- [ ] Can hear all participants
- [ ] Mute/unmute works for all
- [ ] Audio quality is acceptable
- [ ] No echo or feedback

### Debate Integration:

- [ ] Turn management works with audio
- [ ] Current speaker indicator accurate
- [ ] Chat works alongside audio
- [ ] System messages appear correctly

### Advanced Features:

- [ ] Multiple participants can speak simultaneously
- [ ] Audio continues during turn changes
- [ ] No audio drops during phase transitions
- [ ] Reconnection works if someone drops

## Next Steps After Audio Success

Once audio streaming is working perfectly:

1. **Video Testing**: Enable video in Jitsi configuration
2. **Screen Sharing**: Test presentation capabilities
3. **Recording**: Test debate recording features
4. **Mobile Testing**: Test on mobile devices
5. **Load Testing**: Test with maximum participants

## Quick Test Script

Run this in browser console to check Jitsi status:

```javascript
// Check if Jitsi is loaded
console.log("Jitsi API available:", !!window.JitsiMeetExternalAPI);

// Check if Jitsi instance exists
console.log("Jitsi instance running:", !!window.jitsiAPI);

// Test audio devices
navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then(() => console.log("✅ Microphone access granted"))
  .catch((err) => console.log("❌ Microphone access denied:", err));
```

## Success Criteria

Audio streaming is successful when:

1. All participants can hear each other clearly
2. Mute/unmute controls work properly
3. No audio drops or quality issues
4. Turn management integrates smoothly with audio
5. Multiple participants can communicate naturally

Ready to test? Start with Phase 1 and work through each step systematically!
