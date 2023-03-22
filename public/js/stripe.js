/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async (tourId, startDate) => {
  try {
    const stripe = Stripe(
      'pk_test_51MhTrUJk8bflUZ08XfhsZDFW5L2OMHSI28XrYha2sfJIJYN3dR3az9qSfUGokyDgi01qSVXmRfUuLGIqcLCEsSdx00Qqv44SYF'
    );
    // 1) Get checkout session from API
    const session = await axios(
      `/api/v1/bookings/checkout-session/?tour=${tourId}&startDate=${startDate}`
    );

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
