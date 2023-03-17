import axios from 'axios';
import { showAlert } from './alert';

export const postReview = async (tourId, rating, review) => {
  try {
    const res = await axios({
      method: 'POST',
      url: `http://127.0.0.1:8080/api/v1/tours/${tourId}/reviews`,
      data: {
        rating,
        review,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Your review has been posted!');
      window.setTimeout(() => {
        location.reload(true);
      }, 1000);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
