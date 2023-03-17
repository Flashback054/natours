/* eslint-disable */
// Polyfill for lower browser compatibility
import '@babel/polyfill';

import { login, signup, logout } from './login';
import { displayMap } from './mapbox';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';
import { postReview } from './review';

// DOM ELEMENT
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const signupForm = document.querySelector('.form--signup');
const logoutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookTourToggle = document.getElementById('book-tour-toggle');
const bookTourBtns = document.querySelectorAll('.book-tour');
const modal = document.querySelector('.modal');
const modalList = document.querySelector('.modal-list');
const postReviewBtn = document.querySelector('.btn-post-review');
const postReviewForm = document.querySelector('.modal-review-form');
const submitReviewBtn = document.querySelector('.btn--review');

if (mapBox) {
  const locations = JSON.parse(
    document.getElementById('map').dataset.locations
  );
  displayMap(locations);
}

if (loginForm)
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    await login(email, password);
  });

if (signupForm)
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--signup').textContent = 'Signing up...';

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    await signup(name, email, password, passwordConfirm);
    document.querySelector('.btn--signup').textContent = 'Sign up';
  });

if (logoutBtn) logoutBtn.addEventListener('click', logout);

if (userDataForm)
  userDataForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--save-settings').textContent = 'Saving...';

    let form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);

    await updateSettings(form, 'data');
    document.querySelector('.btn--save-settings').textContent = 'Save settings';
  });

if (userPasswordForm)
  userPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--save-password').textContent = 'Saving...';

    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      'password'
    );
    document.querySelector('.btn--save-password').textContent = 'Save password';
  });

if (bookTourToggle) {
  bookTourToggle.addEventListener('click', function () {
    modal.classList.remove('modal--inactive');
    modalList.classList.remove('modal--inactive');
  });
}

if (bookTourBtns)
  bookTourBtns.forEach((bookTourBtn) => {
    bookTourBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      bookTourBtn.textContent = 'Processing...';
      const { tourId, startDate } = e.target.dataset;
      await bookTour(tourId, startDate);
    });
  });

if (modal) {
  modal.addEventListener('click', function () {
    modal.classList.add('modal--inactive');
    modalList.classList.add('modal--inactive');
    postReviewForm.classList.add('modal--inactive');
  });
}

if (postReviewForm) {
  const ratingRadios = document.querySelectorAll("input[name='rating']");
  const starSvgs = document.querySelectorAll(
    '.reviews__star.reviews__star--form'
  );

  starSvgs.forEach((star, index) => {
    star.addEventListener('click', (e) => {
      for (let i = 0; i < starSvgs.length; i++) {
        if (i <= index) {
          starSvgs[i].classList.remove('reviews__star--inactive');
          starSvgs[i].classList.add('reviews__star--active');
        } else {
          starSvgs[i].classList.add('reviews__star--inactive');
          starSvgs[i].classList.remove('reviews__star--active');
        }
      }
    });
  });
}

if (postReviewBtn) {
  postReviewBtn.addEventListener('click', function () {
    modal.classList.remove('modal--inactive');
    postReviewForm.classList.remove('modal--inactive');
  });
}

if (submitReviewBtn)
  submitReviewBtn.addEventListener('click', async function (e) {
    e.preventDefault();

    submitReviewBtn.textContent = 'Posting...';
    const tourId = submitReviewBtn.dataset.tourId;
    const rating = document.querySelector('input[name="rating"]:checked').value;
    const review = document.querySelector('input#review').value;

    await postReview(tourId, rating, review);
    submitReviewBtn.textContent = 'Post review';
  });
