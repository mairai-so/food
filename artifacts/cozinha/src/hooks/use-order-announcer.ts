import { KitchenOrder } from '../lib/kitchen-api';
import { useVoice } from './use-voice';
import { useGetKitchenSettings } from '../lib/kitchen-api';

export function formatOrderAnnouncement(order: KitchenOrder) {
  const itemsText = order.items.map(item => {
    let text = `${item.quantity} ${item.name}`;
    if (item.notes) text += ` com ${item.notes}`;
    return text;
  }).join(', e ');

  let text = `Atenção, mesa ${order.tableNumber}. ${itemsText}.`;

  if (order.customerAllergies && order.customerAllergies.length > 0) {
    text += ` Alerta de alergia para: ${order.customerAllergies.join(', ')}.`;
  }

  return text;
}

export function useOrderAnnouncer() {
  const { speak } = useVoice();
  const { data: settings } = useGetKitchenSettings();

  const announceOrder = (order: KitchenOrder, rate: number = 1.0, pitch: number = 1.0) => {
    speak(formatOrderAnnouncement(order), rate, pitch);
  };

  const shouldAutoAnnounce = (order: KitchenOrder) => {
    if (!settings) return false;

    if (settings.announceAllergiesOnly) {
      return (order.customerAllergies && order.customerAllergies.length > 0);
    }

    return settings.autoAnnounceOrders;
  };

  return { announceOrder, shouldAutoAnnounce };
}
