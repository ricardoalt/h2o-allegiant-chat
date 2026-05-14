import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRequiredError } from "./errors";
import {
  createCognitoAccessTokenVerifier,
  createLambdaOwnerResolver,
  type LambdaOwnerVerifier,
  ownerFromAuthorizationHeader,
  parseBearerToken,
} from "./lambda-owner";

const createVerifierMock = vi.hoisted(() => vi.fn());

vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: createVerifierMock,
  },
}));

const validClaims = {
  client_id: "client-123",
  sub: "user-sub-123",
  token_use: "access",
};

const verifierReturning = (claims: unknown): LambdaOwnerVerifier => ({
  verify: vi.fn(async () => claims),
});

const verifierRejecting = (error: unknown): LambdaOwnerVerifier => ({
  verify: vi.fn(async () => {
    throw error;
  }),
});

const expectAuthRequired = async (operation: Promise<unknown>) => {
  await expect(operation).rejects.toBeInstanceOf(AuthRequiredError);
};

describe("Lambda Cognito owner adapter", () => {
  beforeEach(() => {
    createVerifierMock.mockReset();
  });

  it("extracts Bearer tokens without returning the prefix", () => {
    expect(parseBearerToken("Bearer access-token-value")).toBe("access-token-value");
  });

  it("rejects missing authorization headers", async () => {
    await expectAuthRequired(
      ownerFromAuthorizationHeader(undefined, verifierReturning(validClaims)),
    );
  });

  it("rejects malformed Bearer authorization headers", async () => {
    await expectAuthRequired(
      ownerFromAuthorizationHeader("Basic credentials", verifierReturning(validClaims)),
    );
    await expectAuthRequired(
      ownerFromAuthorizationHeader("Bearer", verifierReturning(validClaims)),
    );
  });

  it("maps a verified Cognito access-token sub to OwnerContext userId and identityId", async () => {
    const verifier = verifierReturning(validClaims);

    await expect(ownerFromAuthorizationHeader("Bearer valid-token", verifier)).resolves.toEqual({
      userId: "user-sub-123",
      identityId: "user-sub-123",
    });
    expect(verifier.verify).toHaveBeenCalledWith("valid-token");
  });

  it("rejects verifier failures such as expired token, wrong issuer, or wrong client", async () => {
    await expectAuthRequired(
      ownerFromAuthorizationHeader("Bearer expired-token", verifierRejecting(new Error("expired"))),
    );
    await expectAuthRequired(
      ownerFromAuthorizationHeader(
        "Bearer wrong-issuer",
        verifierRejecting(new Error("wrong issuer")),
      ),
    );
    await expectAuthRequired(
      ownerFromAuthorizationHeader(
        "Bearer wrong-client",
        verifierRejecting(new Error("wrong client")),
      ),
    );
  });

  it("rejects ID tokens instead of accepting them as Lambda chat authorization", async () => {
    await expectAuthRequired(
      ownerFromAuthorizationHeader(
        "Bearer id-token",
        verifierReturning({ ...validClaims, token_use: "id" }),
      ),
    );
  });

  it("rejects access tokens with a missing or empty sub", async () => {
    await expectAuthRequired(
      ownerFromAuthorizationHeader(
        "Bearer missing-sub",
        verifierReturning({ client_id: "client-123", token_use: "access" }),
      ),
    );
    await expectAuthRequired(
      ownerFromAuthorizationHeader(
        "Bearer empty-sub",
        verifierReturning({ ...validClaims, sub: "" }),
      ),
    );
  });

  it("ignores unexpected scopes while keeping owner mapping deterministic", async () => {
    await expect(
      ownerFromAuthorizationHeader(
        "Bearer scoped-token",
        verifierReturning({ ...validClaims, scope: "aws.cognito.signin.user.admin" }),
      ),
    ).resolves.toEqual({
      userId: "user-sub-123",
      identityId: "user-sub-123",
    });
  });

  it("creates an aws-jwt-verify Cognito access-token verifier from reusable config", async () => {
    const verify = vi.fn(async () => validClaims);
    createVerifierMock.mockReturnValue({ verify });

    const verifier = createCognitoAccessTokenVerifier({
      clientId: "client-123",
      userPoolId: "us-east-1_pool123",
    });

    await expect(verifier.verify("jwt-value")).resolves.toEqual(validClaims);
    expect(createVerifierMock).toHaveBeenCalledWith({
      clientId: "client-123",
      tokenUse: "access",
      userPoolId: "us-east-1_pool123",
    });
    expect(verify).toHaveBeenCalledWith("jwt-value");
  });

  it("creates a request-bound getOwner adapter without exposing JWT claims", async () => {
    const getOwner = createLambdaOwnerResolver({
      authorizationHeader: "Bearer valid-token",
      verifier: verifierReturning(validClaims),
    });

    await expect(getOwner()).resolves.toEqual({
      userId: "user-sub-123",
      identityId: "user-sub-123",
    });
  });
});
