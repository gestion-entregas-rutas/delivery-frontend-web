// Configuracion para la publicacion local en IIS (Jenkins: ng build --configuration production,iis).
// La API local corre en el sitio IIS delivery-api (puerto 5289).
export const environment = {
  apiServerUrl: 'http://localhost:5289',
};
