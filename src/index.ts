import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import AWS from "aws-sdk";
import 'dotenv/config';

import crypto from 'crypto';

const app: Express = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = 8081;

AWS.config.update({ region: "us-east-1"});

const userPoolId = process.env.USER_POOL_ID;
const userPoolClientId = process.env.USER_POOL_CLIENT_ID!;
const userPoolClientSecret = process.env.USER_POOL_CLIENT_SECRET!;
const tableName = process.env.TABLE_NAME!;
const userType = 0;

const cIP = new AWS.CognitoIdentityServiceProvider();
const docClient = new AWS.DynamoDB.DocumentClient();

interface SignUpBase {
  countryCode: string,
  documentType: string,
  documentNumber: string,
}
interface SignUpReq {
  email: string,
  phoneNumber: string,
  firstName: string,
  middleName: string,
  firstSurname: string,
  secondSurname: string,
  signUpOrigin: string
}
interface SignUpReq2 {
  confirmationCode: string
}
interface SignUpReq3 {
  password: string
}

function hashSecret(clientSecret: string, username: string, clientId: string) {
  return crypto
    .createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64')
}

app.get( "/", ( req: Request, res: Response) => {
  res.send( "Hello world!" );
} );

app.post( "/signUp", async ( req: Request, res: Response) => {
  const reqBody = req.body as SignUpBase & SignUpReq & SignUpReq3;
  const userName = [reqBody.countryCode + reqBody.documentType + reqBody.documentNumber].join("").toLowerCase();

  var params = {
    ClientId: userPoolClientId,
    Password: reqBody.password,
    Username: userName,
    SecretHash: hashSecret(userPoolClientSecret, userName, userPoolClientId),
    UserAttributes: [
      {
        Name: 'email',
        Value: reqBody.email
      },
      {
        Name: 'phone_number',
        Value: reqBody.phoneNumber
      },
      {
        Name: 'custom:country_code',
        Value: reqBody.countryCode
      },
      {
        Name: 'custom:document_type',
        Value: reqBody.documentType
      },
      {
        Name: 'custom:document_number',
        Value: reqBody.documentNumber
      },
      {
        Name: 'custom:first_name',
        Value: reqBody.firstName
      },
      {
        Name: 'custom:middle_name',
        Value: reqBody.middleName
      },
      {
        Name: 'custom:first_surname',
        Value: reqBody.firstSurname
      },
      {
        Name: 'custom:second_surname',
        Value: reqBody.secondSurname
      },
      {
        Name: 'custom:signup_origin',
        Value: reqBody.signUpOrigin
      },
      {
        Name: 'custom:user_type',
        Value: '0'
      }
    ]
  };
  
  let user_id = [reqBody.countryCode, reqBody.documentType, reqBody.documentNumber, userType];
  const paramsTable = {
    TableName: tableName,
    Item: {
      "user_Id": user_id.join("#").toLowerCase(),
      "record_type": "user_v01",
      "userName": userName,
      "countryCode": reqBody.countryCode,
      "documentType": reqBody.documentType,
      "documentNumber": reqBody.documentNumber,
      "phoneNumber": reqBody.phoneNumber,
      "email": reqBody.email,
      "user_type": userType,
      "createdAt": new Date().toISOString()
    }
  }
  
  try{
    const response = await cIP.signUp(params).promise();
    console.log(`user has been created -> '${params.Username}'`);

    const responseTable = await docClient.put(paramsTable).promise();
    console.log(`info has been saved in table -> '${paramsTable.Item.user_Id}'`);

    res
      .status(200)
      .json({
        responseCognito: response,
        responseDynamoDB: responseTable
      });
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post( "/confirmSignUp", async ( req: Request, res: Response) => {
  const reqBody = req.body as SignUpBase & SignUpReq2;
  const userName = [reqBody.countryCode + reqBody.documentType + reqBody.documentNumber].join("").toLowerCase();

  var params = {
    ClientId: userPoolClientId,
    ConfirmationCode: reqBody.confirmationCode,
    Username: userName,
    SecretHash: hashSecret(userPoolClientSecret, userName, userPoolClientId)
  };
  
  try{
    const response = await cIP.confirmSignUp(params).promise();
    res.send(response);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post( "/resendOTP", async ( req: Request, res: Response) => {
  const reqBody = req.body as SignUpBase;
  const userName = [reqBody.countryCode + reqBody.documentType + reqBody.documentNumber].join("").toLowerCase();

  var params = {
    ClientId: userPoolClientId,
    Username: userName,
    SecretHash: hashSecret(userPoolClientSecret, userName, userPoolClientId)
  };
  
  try{
    const response = await cIP.resendConfirmationCode(params).promise();
    res.send(response);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post( "/logIn", async ( req: Request, res: Response) => {
  const reqBody = req.body as SignUpBase & SignUpReq3;
  const userName = [reqBody.countryCode + reqBody.documentType + reqBody.documentNumber].join("").toLowerCase();

  var params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: userPoolClientId,
    AuthParameters: {
      "USERNAME": userName,
      "PASSWORD": reqBody.password,
      "SECRET_HASH": hashSecret(userPoolClientSecret, userName, userPoolClientId)
    }
  };

  try{
    const response = await cIP.initiateAuth(params).promise();

    res.send(response);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post( "/verifyPhone", async ( req: Request, res: Response) => {
  const accessToken = req.headers.authorization as string;

  var params = {
    AccessToken: accessToken.replace("Bearer ", ""),
    AttributeName: "phone_number"
  };
  
  try{
    const response = await cIP.getUserAttributeVerificationCode(params).promise();
    res.send(response);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post( "/verifyPhoneOTP", async ( req: Request, res: Response) => {
  const accessToken = req.headers.authorization as string;

  var params = {
    AccessToken: accessToken.replace("Bearer ", ""),
    AttributeName: "phone_number",
    Code: req.body.code
  };
  
  try{
    const response = await cIP.verifyUserAttribute(params).promise();
    res.send(response);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post( "/signOut", async ( req: Request, res: Response) => {
  const accessToken = req.headers.authorization as string;
  const deviceKey = req.headers["x-device-id"] as string;
  
  try{
    var params = {
      AccessToken: accessToken.replace("Bearer ", ""),
      DeviceKey: deviceKey,
    };
  
    console.log(params);

    const response = await cIP.forgetDevice(params).promise();
    res.send(response);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.listen( port, () => {
    console.info( `server started at one http://localhost:${ port }` );
} );