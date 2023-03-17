/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

// type is either 'password' or 'data'
export const updateSettings = async (data, type) => {
  try {
    const urlEndpoint =
      type === 'password' ? 'update-my-password' : 'update-me';
    const res = await axios({
      method: 'PATCH',
      url: `http://127.0.0.1:8080/api/v1/users/${urlEndpoint}`,
      data,
    });

    if (res.data.status === 'success') {
      showAlert('success', `${type.toUpperCase()} updated successfully!`);
      window.setTimeout(() => {
        location.reload(true);
      }, 1000);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
