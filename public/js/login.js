/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      url: 'http://127.0.0.1:8080/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully!');
      window.setTimeout(() => {
        location.assign('/');
      }, 500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

export const signup = async (name, email, password, passwordConfirm) => {
  try {
    const res = await axios({
      method: 'POST',
      url: 'http://127.0.0.1:8080/api/v1/users/signup',
      data: {
        name,
        email,
        password,
        passwordConfirm,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Sign up successfully!');
      window.setTimeout(() => {
        location.assign('/');
      }, 500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

// Send and invalid 'loggedout' jwt to replace current valid jwt
// Reason: b/c jwt is httpOnly => can't be accessed by browser
export const logout = async (req, res, next) => {
  try {
    const res = await axios({
      method: 'GET',
      url: 'http://127.0.0.1:8080/api/v1/users/logout',
    });

    if (res.data.status === 'success') {
      // Reload current page (set to 'true' to force browser to manually reload page instead of get page from cache)
      // location.reload(true);
      // OR location.assign('/') to return to home page
      location.assign('/');
    }
  } catch (err) {
    showAlert('error', 'Error logging out! Try again.');
  }
};
