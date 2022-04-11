# Flujo de validacion de firma digital

Luego del proceso de autenticación, es necesario validar que la firma digital del token no ha sido alterada. Para ello se genera un autorizador que se configurará en el aws gw el cual interceptara las peticiones y validara las firmas, al final el autorizador retornara una politica de aws indicando al gateway si la petición puede continuar o no.


![img.png](img/Autorizador.png)

Para este flujo se tienen 4 componentes:

**1. APIC:** Gateway externo, encargado de la generación de tokens de cara a los clientes.

**2. AWS Gateway:** Gateway interno, encargado de exponer los servicios.

**3. Authorizator:** Lambda que nos dara soporte para la validacion de firmas de los token generados internamiente.

**4. Cognito:** Gestor de identidad que nos permitira validar usuarios y generar tokens internos.


Una vez que un cliente tiene un token valido del APIC, puede realizar la invocación a los servicios expuestos por el AWS Gateway, siempre pasando por el APIC. El proceso sera el siguiente:

1. Toda petición, para consumir un servicio, sera enviada por el APIC al AWS Gateway.
2. El AWS Gateway, al tener un autorizador configurado, enviara los datos del header para su validación.
3. El Autorizador se conectara a cognito a traves de su ruta /.well-known/jwks.json para obtener sus llaves publicas.
4. Autorizador validara las llaves publicas y los siguientes datos:
- Tiempo de expiración del token
- Tipo de token
- Issuer
- kid

5. De ser valida la petición, autorizador devolvera una politica AWS dando el permiso.

```json
{
    "principalId": "12233333333333333333333",
    "policyDocument": {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": "execute-api:Invoke",
                "Effect": "Allow",
                "Resource": "*"
            }
        ]
    }
}
```

## Authorizator

### Repositories

### getPublicKeys

services/identity-api/src/infraestructure/AuthorizerRepositoryImpl.ts

Nos permite obtener las llaves publicas de cognito usando jwks ${this.cognitoIssuer}/.well-known/jwks.json

-   **`input:`** No requiere
-   **`output:`** MapOfKidToPublicKey con las llaves


### Services

### verifySignature
```
services/identity-api/src/application/AuthorizerServiceImpl.ts
```

-   **`input:`** ClaimVerifyRequest
    -    **token** 
    -    **methodArn:** Identificador unico del metodo al que se quiere acceder
-   **`output:`** IAMPolicy, con las politicas para indicar al gw si la petición paso la validación.
    -    **principalId**
    -    **policyDocument**
    
1. Accede al token y separa el header y body.
2. Obtiene las llaves publicas del repository getPublicKeys
3. Valida kid
4. Verifica y obtiene el claim del jwt usando la llave publica.
5. Retorna politica de aws al gw

