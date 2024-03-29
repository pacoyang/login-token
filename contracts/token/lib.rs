#![cfg_attr(not(feature = "std"), no_std, no_main)]

extern crate alloc;

#[ink::contract]
mod token {
    use alloc::{string::String, vec::Vec};
    use hmac::{Hmac, Mac};
    use scale::{Decode, Encode};
    use sha2::Sha256;

    #[ink(storage)]
    pub struct Token {
        owner: AccountId,
        secret_key: String,
    }

    #[derive(Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        NotOwner,
    }

    pub type Result<T> = core::result::Result<T, Error>;
    type HmacSha256 = Hmac<Sha256>;

    impl Token {
        #[ink(constructor)]
        pub fn new(secret_key: String) -> Self {
            Self {
                owner: Self::env().caller(),
                secret_key,
            }
        }

        fn ensure_owner(&self) -> Result<()> {
            if self.env().caller() == self.owner {
                Ok(())
            } else {
                Err(Error::NotOwner)
            }
        }

        #[ink(message)]
        pub fn get_secret_key(&self) -> Result<String> {
            self.ensure_owner()?;
            Ok(self.secret_key.clone())
        }

        #[ink(message)]
        pub fn set_secret_key(&mut self, secret_key: String) -> Result<String> {
            self.ensure_owner()?;
            self.secret_key = secret_key;
            Ok(self.secret_key.clone())
        }

        #[ink(message)]
        pub fn get_account_id(&self) -> AccountId {
            self.env().caller()
        }

        #[ink(message)]
        pub fn get_hex_account_id(&self) -> String {
            hex::encode(self.env().caller())
        }

        #[ink(message)]
        pub fn create_token(&self) -> String {
            self.create_signature(self.env().caller())
        }

        #[ink(message)]
        pub fn verify_token(&self, token: String, account_id: AccountId) -> bool {
            let signature = self.create_signature(account_id);
            signature == token
        }

        fn create_signature(&self, account_id: AccountId) -> String {
            let signature_bytes = self.hmac_sign(
                self.secret_key.as_bytes(),
                account_id.encode().as_slice(),
            );
            let signature = base16::encode_lower(&signature_bytes);
            signature
        }

        fn hmac_sign(&self, key: &[u8], msg: &[u8]) -> Vec<u8> {
            let mut mac = <HmacSha256 as Mac>::new_from_slice(key)
                .expect("Could not instantiate HMAC instance");
            mac.update(msg);
            let result = mac.finalize().into_bytes();
            result.to_vec()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn it_works() {
            let instance = Token::new(String::from("secret_key"));
            let account_id = AccountId::from([1u8; 32]);
            let token = instance.create_signature(account_id);
            assert!(instance.verify_token(token, account_id));
        }
    }
}
