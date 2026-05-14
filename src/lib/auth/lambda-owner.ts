import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { OwnerContext } from "@/lib/auth/owner-context";
import { AuthRequiredError } from "./errors";

export type LambdaOwnerVerifier = {
  verify(token: string): Promise<unknown>;
};

export type CognitoAccessTokenVerifierConfig = {
  userPoolId: string;
  clientId: string;
};

export type CreateLambdaOwnerResolverInput = {
  authorizationHeader?: string;
  verifier: LambdaOwnerVerifier;
};

type CognitoAccessClaims = {
  sub?: unknown;
  token_use?: unknown;
};

const BEARER_PREFIX = "Bearer ";

const authRequired = (): AuthRequiredError => new AuthRequiredError();

export const parseBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
    throw authRequired();
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw authRequired();
  }

  return token;
};

const isCognitoAccessClaims = (claims: unknown): claims is CognitoAccessClaims =>
  typeof claims === "object" && claims !== null;

const ownerFromClaims = (claims: unknown): OwnerContext => {
  if (!isCognitoAccessClaims(claims) || claims.token_use !== "access") {
    throw authRequired();
  }

  if (typeof claims.sub !== "string" || claims.sub.trim() === "") {
    throw authRequired();
  }

  return {
    userId: claims.sub,
    identityId: claims.sub,
  };
};

export const createCognitoAccessTokenVerifier = ({
  clientId,
  userPoolId,
}: CognitoAccessTokenVerifierConfig): LambdaOwnerVerifier => {
  const verifier = CognitoJwtVerifier.create({
    clientId,
    tokenUse: "access",
    userPoolId,
  });

  return {
    verify: (token: string) => verifier.verify(token),
  };
};

export const ownerFromAuthorizationHeader = async (
  authorizationHeader: string | undefined,
  verifier: LambdaOwnerVerifier,
): Promise<OwnerContext> => {
  const token = parseBearerToken(authorizationHeader);

  try {
    const claims = await verifier.verify(token);
    return ownerFromClaims(claims);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw error;
    }

    throw authRequired();
  }
};

export const createLambdaOwnerResolver = ({
  authorizationHeader,
  verifier,
}: CreateLambdaOwnerResolverInput): (() => Promise<OwnerContext>) => {
  return () => ownerFromAuthorizationHeader(authorizationHeader, verifier);
};
