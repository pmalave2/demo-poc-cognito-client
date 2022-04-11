# Flujo de autenticación

![img.png](img/Autenticacion.png)

El flujo de autenticación contiene 3 componentes

- **Identity:** Lambda que dara soporte al proceso de autenticación
- **APIC (API Connect):** API Manager encargado del oauth
- **Cognito:** Gestor de identidades


## Identity

Nos dara soporte para poder integrar con cognito atraves de un servicio.

### Repositories

#### getToken
``` {.bash}
services/identity-api/src/infraestructure/TokenRepositoryImpl.ts
```

Este repository realizará la integracion directa con cognito para autenticar a un usuario usando el metodo adminInitiateAuth.

-   **input:**
    -    **email:** email del usuario a autenticar
    -    **password:** Password del usuario a autenticar
    -    **client_id:** Id asignado a la aplicación que consumira el servicio oauth
    -    **client_secret:** Clave asignada a la aplicación que consumira el servicio oauth
-   **output:** Entidad Token, este token sera propio de cognito
    -    **accessToken:** Access token generado por cognito, este token no sera retornado por el apic ya que usara el propio
    -    **idToken:** id Token generado por cognito, este token sera retornado por el apic en el campo metadata
    -    **refreshToken:** Refresh token generado por cognito, este token no sera retornado por el apic ya que usara el propio


Invocacion a cognito usando adminInitiateAuth
```typescript
      adminInitiateAuthResponse = await cognitoIdentityServiceProvider
        .adminInitiateAuth({
          ClientId: clientId.clientId,
          UserPoolId: this.userPoolId,
          AuthFlow: 'ADMIN_NO_SRP_AUTH',
          AuthParameters: {
            USERNAME: email.email,
            PASSWORD: password.password,
          },
        })
        .promise();
```

Variables de entorno

- **`USER_POOL_ID:`** Valor de Pool Id en general settings de cognito
- **`APIC_CLIENT_NAME:`** Valor de App client en sección de App Client Settings en cognito


#### ebkLogin
``` {.bash}
services/identity-api/src/infraestructure/EBookingRepositoryImpl.ts
```

Este repository nos permitira validar si un usuario existe en ebooking y lo logeara

-   **`input:`**
    -    **userId:** email del usuario a autenticar
    -    **password:** Password del usuario a autenticar
-   **`output:`** String con el password

### Services

#### getToken
``` {.bash}
services/identity-api/src/application/OAuthServiceImpl.ts
```
Este service nos permitirá realizar validaciones orquestando los repositories para poder obtener un token
1. Invoca al repository ebkLogin para intentar autenticar al usuario en ebooking
2. De ser exitoso el punto 1, obtiene el token invocando al repository getToken

-   **`input:`**
    -    **email:** email del usuario a autenticar
    -    **password:** Password del usuario a autenticar
    -    **client_id:** Id asignado a la aplicación que consumira el servicio oauth
    -    **client_secret:** Clave asignada a la aplicación que consumira el servicio oauth
-   **`output:`** Entidad Token con los siguientes valores
    -    **accessToken:** Access token generado por cognito
    -    **idToken:** id Token generado por cognito
    -    **refreshToken:** Refresh token generado por cognito



### Controller

#### getTokenForAPIC
``` {.bash}
services/identity-api/src/controller/tokenForAPIC.ts
```

Handler que nos pemitira exponer las funcionalidades de cognito como servicio usando el service getToken.

## APIC

El APIC expondra una interfaz de oauth2 que se conectará con el metodo getTokenForAPIC de identity para poder realizar la validacion de usuario y clave. Generara su propio set de tokens los cuales seran enviados a los consumidores para su posterior uso.

-   **`input:`**
    -    **grant_type:** Para este caso siempre sera "password"
    -    **scope:** Para este caso siempre sera "details"
    -    **username:** Usuario a autenticar
    -    **password:** Password del usuario a autenticar
    -    **client_id:** Id asignado a la aplicación que consumira el servicio oauth
    -    **client_secret:** Clave asignada a la aplicación que consumira el servicio oauth
-   **`output:`** Genera un set de tokens, estos token son propios del apic
    -    **token_type:** Para este caso siempre sera Bearer
    -    **access_token:** Access token generado por el apic
    -    **scope:** Mismo valor ingresado en el input
    -    **refresh_token:** Regresh token generado por el apic
    -    **metadata:** Contiene el id_token generado por cognito

Una vez generado el token, la invocacion a los servicios sera usando el oauth provider del apic, por ello el apic solo retorna su propio access y refresh token. El access y refresh token de cognito son descartados, APIC solo retornara el id token de cognito que solo servirá para validaciones posteriores.

