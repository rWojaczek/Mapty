'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnSort = document.querySelector('.sort');

const workout = class {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
};

const Running = class extends workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
};

const Cycling = class extends workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.caclSpeed();
    this._setDescription();
  }
  caclSpeed() {
    //km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
};

//APLICATION ARCHITECTURE
const App = class {
  #allMarker = [];
  #marker;
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  editMode = { state: false, workout: undefined };
  constructor() {
    this._getPosition();

    this._getLocalStorage();

    form.addEventListener('submit', this.__newWorkout.bind(this));

    inputType.addEventListener('change', this.__toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    containerWorkouts.addEventListener('click', this.deleteWorkout.bind(this));

    containerWorkouts.addEventListener('click', this.editWorkout.bind(this));

    btnSort.addEventListener('click', this.sort.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this.__loadMap.bind(this),
        function () {
          alert('could not get your position');
        }
      );
    }
  }

  __loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //handling clicks on map
    this.#map.on('click', this.__showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkutMarker(work);
    });
  }

  __showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
    this.editMode.state = false;
  }

  _hideForm() {
    //empty input
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  __toggleElevationField() {
    inputElevation.closest('.form__row').classList.remove('form__row--hidden');
    inputCadence.closest('.form__row').classList.remove('form__row--hidden');

    if (inputType.value === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    }
    if (inputType.value === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }
  }

  __newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    //get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let { lat, lng } = this.#mapEvent?.latlng || { lat: 42, lng: 42 };
    let workout;

    if (this.editMode.state) {
      [lat, lng] = this.editMode.workout.coords;
    }
    // if activity running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      //check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('input have to be positive numbers');

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    //if activity cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      //check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('input have to be positive numbers');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    if (this.editMode.state) {
      const woIndex = this.#workouts.findIndex(
        wo => wo.id === this.editMode.workout.id
      );

      this.#workouts.splice(woIndex, 1);

      this.#allMarker[woIndex].remove();
      this.#allMarker.splice(woIndex, 1);

      this.editMode.state = false;
      this.editMode.workout = undefined;
    }
    //add new object to workouts array
    this.#workouts.push(workout);
    //render workout on map as marker
    this._renderWorkutMarker(workout);
    //render workout on list
    this._renderWorkout(workout);

    //clear input fields
    this._hideForm();
    //set local sorage to all workouts
    this._setLocalStorage();
  }

  _renderWorkutMarker(workout) {
    this.#marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 200,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#allMarker.push(this.#marker);
  }

  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="top">
          <h2 class="workout__title">${workout.description}</h2>
          <button class="delete_workout btn">delete</button>
          <button class="edit_workout btn">edit</button>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        `;

    if (workout.type === 'running')
      html += `
            <div class="workout__details">
              <span class="workout__icon">⚡️</span>
              <span class="workout__value">${workout.pace.toFixed(1)}</span>
              <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">🦶🏼</span>
              <span class="workout__value">${workout.cadence}</span>
              <span class="workout__unit">spm</span>
            </div>
          </li>
        `;

    if (workout.type === 'cycling')
      html += `
            <div class="workout__details">
              <span class="workout__icon">⚡️</span>
              <span class="workout__value">${workout.speed.toFixed(1)}</span>
              <span class="workout__unit">km/h</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">⛰</span>
              <span class="workout__value">${workout.elevationGain}</span>
              <span class="workout__unit">m</span>
            </div>
          </li>
          `;

    form.insertAdjacentHTML('afterend', html);
  }

  editWorkout(e) {
    if (!e.target.classList.contains('edit_workout')) return;

    const workoutTab = e.target.closest('.workout');
    const workoutId = workoutTab.dataset.id;
    const workoutIndex = this.#workouts.find(work => work.id === workoutId);

    workoutTab.replaceWith(form);
    this.__showForm();
    if (inputType.value !== workoutIndex.type) this.__toggleElevationField();
    inputType.value = workoutIndex.type;
    inputDistance.value = workoutIndex.distance;
    inputDuration.value = workoutIndex.duration;
    if (workoutIndex.type === 'cycling')
      inputElevation.value = workoutIndex.elevationGain;
    if (workoutIndex.type === 'running')
      inputCadence.value = workoutIndex.cadence;

    this.editMode.state = true;
    this.editMode.workout = workoutIndex;
  }

  deleteWorkout(e) {
    if (!e.target.classList.contains('delete_workout')) return;
    const workoutTab = e.target.closest('.workout');
    const workoutId = workoutTab.dataset.id;
    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workoutId
    );
    //delete marker
    this.#allMarker[workoutIndex].remove();
    this.#allMarker.splice(workoutIndex, 1);
    //delete list item
    containerWorkouts.removeChild(workoutTab);
    //delete from workouts arr
    this.#workouts.splice(workoutIndex, 1);
    //update local
    this._setLocalStorage();
  }

  sort() {
    this.#workouts.sort((a, b) => a.distance - b.distance);
    this._setLocalStorage();

    containerWorkouts.querySelectorAll('.workout').forEach(el => el.remove());

    this._getLocalStorage();
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workout', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workout'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  //feture to clear localStorageObjects
  reset() {
    localStorage.removeItem('workout');
    location.reload();
  }
};

const app = new App();
