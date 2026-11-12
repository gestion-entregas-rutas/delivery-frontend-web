# Zonas y ubicación del local

La búsqueda de lugares ahora incluye vista previa de contornos e importación explícita al dibujo editable. Consultar [el plan aplicado, límites y configuración](PLAN_BUSQUEDA_CONTORNOS.md).

## Flujo disponible

- «Nueva Zona»: nombre, capacidad entera por ruta y contorno dibujado con clics. Los vértices se arrastran, eliminan o deshacen; no se escriben coordenadas.
- La búsqueda de dirección/sector centra el mapa sin agregar vértices. El administrador delimita el área de entrega explícitamente.
- «Ver cobertura» selecciona la tarjeta y centra su polígono. Seleccionar el polígono o el selector del mapa también actualiza la selección.
- «Editar Zona en el Mapa» consulta la versión vigente del registro antes de abrir el formulario. Se conservan nombre, capacidad, contorno y estado activa/inactiva. El PUT envía únicamente los campos del contrato.
- Se validan coordenadas, vértices repetidos, área nula y bordes que se cruzan antes de guardar. El backend conserva la validación definitiva. Un rechazo conserva el formulario y el dibujo.
- Las pestañas permiten ver zonas y mapa, flota o ambos. No se añadió eliminación permanente: el contrato permite desactivar mediante la edición.

## Ubicación del local

«Ubicar nuestro local» permite escribir la dirección, buscarla y ajustar un marcador. Se muestran nombre y dirección y un marcador diferenciado del contorno. Los mapas permiten centrar en el local; las zonas nuevas empiezan alrededor de esta referencia cuando está configurada.

**Alcance actual:** el contrato OpenAPI 1.1.0 no publica una configuración de local/sucursal/depósito. La referencia se guarda solo en el navegador y puede editarse allí. No se comparte entre equipos ni se envía como origen de rutas, no crea una zona y no modifica la optimización del backend. No se presume una dirección real hasta que el administrador la configure.

El local puede quedar fuera de las zonas de entrega: la web lo informa y no inventa esa restricción de negocio. La relación con zonas es una ayuda visual, sin sustituir las reglas geográficas del servidor.

## Cobertura al registrar pedidos

El selector de ubicación de Pedidos muestra todos los polígonos activos y el marcador del local, con un botón para volver a ver la cobertura completa. No se muestran zonas inactivas como destinos habilitados. El punto seleccionado se comprueba después de clic, búsqueda o arrastre; también se revalida al guardar y cuando cambia la lista de zonas.

Fuera de los polígonos aparece: «Este punto está a 16.10 mi de la tienda, fuera del área de cobertura real. Por favor elige otro punto más cercano.» El número se calcula para cada punto con distancia geodésica en línea recta desde el local, expresada en millas con dos decimales; no es distancia de conducción ni un radio que defina cobertura. Un punto cercano fuera del polígono se rechaza; uno dentro de una zona activa se admite independientemente de la distancia.

Sin local configurado, el aviso informa que el punto queda fuera de cobertura y solicita configurar el local para calcular la distancia, sin inventar un número. Un punto cubierto puede registrarse aunque no esté configurada la referencia del local. El formulario conserva el punto rechazado para que se pueda ajustar y mantiene el guardado bloqueado hasta elegir uno cubierto. Las coordenadas se conservan sin redondearlas antes de validar.

Se utiliza el mismo criterio de inclusión por ray casting del dominio actual del backend; la API mantiene la validación definitiva ante cambios concurrentes. No se requiere un endpoint nuevo. Esta restricción de cobertura se aplica al selector de Pedidos, sin impedir que el formulario del local seleccione una referencia fuera de las zonas.

## Solicitud concreta al backend

Para completar la configuración compartida, acordar lectura y actualización administrativa de la sede operativa con nombre, dirección y ubicación (latitud/longitud), identificador y versión si admite edición concurrente. Confirmar:

1. Si hay una sola sede por organización o múltiples sucursales y qué administrador puede editarlas.
2. Si las rutas parten/regresan al local y cómo se utilizará esta ubicación en el armado. El frontend no debe inferirlo.
3. Si el local puede estar fuera de las zonas y qué política aplica a zonas superpuestas.
4. Cómo se propagan cambios a otros administradores y si afectan rutas ya planificadas.

No se envían llamadas a endpoints propuestos. Cuando exista el contrato, sustituir el almacenamiento del navegador por la persistencia compartida y acordar la migración de la referencia provisional.

## Verificación

Pruebas para geometría, DTO de creación/edición, doble envío, errores sin pérdida de dibujo, carga vigente antes de editar y persistencia/errores de la referencia del local. Se mantiene la comprobación de estilos y clases originales. Falta validar visualmente con la dirección real del local y las zonas de operación en navegador.

Resultado actualizado: 81 pruebas aprobadas en 11 archivos, incluidas distancia, polígonos disjuntos, exclusión de zonas inactivas, bloqueo de envíos fuera de cobertura, revalidación al arrastrar y selección del local independiente de cobertura. La verificación conserva las 7 hojas de estilo y las clases originales de las 16 plantillas. Se comprobó el OpenAPI local 1.1.0: solo existen `/api/zonas` y `/api/zonas/{id}` para esta configuración; no hay endpoint de sede/local.
