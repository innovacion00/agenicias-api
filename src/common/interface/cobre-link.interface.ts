export interface IgenerateLink {
  jwt: string;
  cellPhone: string;
  email: string;
  amount: string;
  document: string;
  documentType: string;
  expirationDate: string;
  fullName: string;
  description: string;
  references: string[];
  redirectUrl: string;
}
