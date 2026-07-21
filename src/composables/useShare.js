import { ref } from 'vue';

/**
 * Composable for sharing locations and trip data via Web Share API
 * with clipboard fallback.
 */
export function useShare() {
  const toastMessage = ref('');
  const toastVisible = ref(false);
  let toastTimer = null;

  function showToast(msg) {
    toastMessage.value = msg;
    toastVisible.value = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible.value = false; }, 2000);
  }

  /**
   * Share a location via Web Share API or clipboard fallback.
   */
  async function shareLocation(lat, lng, label) {
    const mapsUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
    const text = `${label}\n${mapsUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: label, text, url: mapsUrl });
      } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Location copied to clipboard');
    }
  }

  /**
   * Share current position on the Thames.
   */
  async function shareCurrentLocation(position, nearestName, riverMile) {
    if (!position) return;
    const label = `📍 I'm on the Thames near ${nearestName || 'mile ' + (riverMile?.toFixed(1) || '?')}`;
    await shareLocation(position.lat, position.lng, label);
  }

  /**
   * Share pickup point (destination) with ETA.
   */
  async function sharePickupPoint(dest, currentRiverMile, avgSpeed) {
    if (!dest) return;
    const remaining = Math.abs(dest.riverMile - currentRiverMile);
    let eta = '';
    if (avgSpeed > 0 && remaining > 0) {
      const mins = Math.round((remaining / avgSpeed) * 60);
      eta = mins < 60 ? ` (approx ${mins} min away)` : ` (approx ${Math.floor(mins / 60)}h ${mins % 60}m away)`;
    }
    const label = `🏁 Please collect me from ${dest.name}${eta}`;
    await shareLocation(dest.lat, dest.lng, label);
  }

  /**
   * Share a map-picked point.
   */
  async function shareMapPoint(lat, lng, nearText, etaText) {
    const label = `📌 Pickup point: ${nearText}${etaText || ''}`;
    await shareLocation(lat, lng, label);
  }

  /**
   * Share safety check-in message.
   */
  async function shareCheckin(position, nearestName, dest, checkinTime) {
    if (!position) return;
    const dueTime = new Date(checkinTime);
    const dueStr = dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let text = `🛟 Kayak Safety Check-in\n`;
    text += `I'm heading out on the Thames${nearestName ? ' near ' + nearestName : ''}`;
    text += dest ? `, paddling to ${dest.name}` : '';
    text += `.\nExpected back by: ${dueStr}`;
    text += `\nIf you haven't heard from me by then, please try to reach me.`;
    text += `\n\n📍 Starting location:\nhttps://maps.google.com/?q=${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
    if (dest) {
      text += `\n\n🏁 Destination:\nhttps://maps.google.com/?q=${dest.lat.toFixed(6)},${dest.lng.toFixed(6)}`;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Kayak Safety Check-in', text });
      } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Check-in message copied to clipboard');
    }
  }

  /**
   * Share check-in update (during trip).
   */
  async function shareCheckinUpdate(position, nearestName, checkinTime) {
    if (!position || !checkinTime) return;
    const dueTime = new Date(checkinTime);
    const dueStr = dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let text = `🛟 Kayak Safety Check-in Update\n`;
    text += `I'm currently on the Thames${nearestName ? ' near ' + nearestName : ''}.\n`;
    text += `Expected finish: ${dueStr}\n`;
    text += `📍 Current location:\nhttps://maps.google.com/?q=${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Check-in Update', text });
      } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Check-in update copied to clipboard');
    }
  }

  /**
   * Share a completed trip summary.
   */
  async function shareTripSummary(trip, formatDist, formatTime, formatSpeed) {
    if (!trip) return;
    const eqName = trip.equipmentType === 'rigid' ? 'Rigid kayak' : trip.equipmentType === 'inflatable' ? 'Inflatable kayak' : 'Kayak';
    let text = `🛶 Thames Paddle\n`;
    text += `📅 ${trip.date}\n`;
    text += `📏 ${formatDist(trip.actualDistanceMiles || 0)} · ⏱ ${formatTime(trip.totalTimeMs || 0)}\n`;
    text += `💨 Avg ${formatSpeed(trip.avgSpeedMph || 0)} · Top ${formatSpeed(trip.maxSpeedMph || 0)}\n`;
    text += `🚣 ${eqName}\n`;

    if (trip.recordedTrack?.length > 1) {
      const first = trip.recordedTrack[0];
      const last = trip.recordedTrack[trip.recordedTrack.length - 1];
      text += `\n📍 Start: https://maps.google.com/?q=${first.lat.toFixed(5)},${first.lng.toFixed(5)}`;
      text += `\n🏁 End: https://maps.google.com/?q=${last.lat.toFixed(5)},${last.lng.toFixed(5)}`;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Thames Paddle Trip', text });
      } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Trip summary copied to clipboard');
    }
  }

  /**
   * Copy trip stats to clipboard.
   */
  async function copyTripStats(trip, formatDist, formatTime, formatSpeed) {
    if (!trip) return;
    let text = `${trip.date}\n`;
    text += `Distance: ${formatDist(trip.actualDistanceMiles || 0)}\n`;
    text += `Time: ${formatTime(trip.totalTimeMs || 0)}\n`;
    text += `Avg Speed: ${formatSpeed(trip.avgSpeedMph || 0)}\n`;
    text += `Top Speed: ${formatSpeed(trip.maxSpeedMph || 0)}\n`;
    text += `Equipment: ${trip.equipmentType || 'unknown'}`;
    await navigator.clipboard.writeText(text);
    showToast('Stats copied to clipboard');
  }

  return {
    toastMessage,
    toastVisible,
    showToast,
    shareLocation,
    shareCurrentLocation,
    sharePickupPoint,
    shareMapPoint,
    shareCheckin,
    shareCheckinUpdate,
    shareTripSummary,
    copyTripStats
  };
}
