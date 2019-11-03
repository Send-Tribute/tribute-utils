# 🏺 Tribute-Utils

[![npm package](https://img.shields.io/npm/v/tribute-utils)](https://www.npmjs.com/package/tribute-utils)
[![Build Status](https://travis-ci.org/Send-Tribute/tribute-utils.svg?branch=master)](https://travis-ci.org/Send-Tribute/tribute-utils)
[![Maintainability](https://api.codeclimate.com/v1/badges/7cc0d71f7bd6e6b9c1ed/maintainability)](https://codeclimate.com/github/Send-Tribute/tribute-utils/maintainability)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/Send-Tribute/tribute-utils.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/Send-Tribute/tribute-utils/context:javascript)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FSend-Tribute%2Ftribute-utils.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FSend-Tribute%2Ftribute-utils?ref=badge_shield)
![](https://img.shields.io/github/license/send-tribute/tribute-utils)

A utility to interact with the rDAI contracts.

## Usage

`tribute.getInfo()`

```js
{
  allocations: [array],
  balance: [number],
  unallocated_balance: [number],
  unclaimed_balance: [number]
}
```

...

## Example

```js
import React, { useState } from 'react';
import Tribute from 'tribute-utils';
import { ethers } from 'ethers';
import { CONTRACTS } from '../../helpers/constants';
import DAIabi from '../../../contracts/dai';
import rDAIabi from '../../../contracts/rDai';

export default function UserAccount() {
  const [state, setState] = useState();

    // 1. enable metamask
    if (window.ethereum) {
      let address = await window.ethereum.enable();
      try {
        if (
          typeof window.ethereum !== 'undefined' ||
          typeof window.web3 !== 'undefined'
        ) {
          let walletProvider = new ethers.providers.Web3Provider(
            window.web3.currentProvider
          );
          // connect to contracts on the network
          const rDAIContract = new ethers.Contract(
            CONTRACTS.rtoken.kovan,
            rDAIabi,
            walletProvider
          );
          const DAIContract = new ethers.Contract(
            CONTRACTS.dai.kovan,
            DAIabi,
            walletProvider
          );
          // create the Tribute object
          const tribute = new Tribute(
            DAIContract,
            rDAIContract,
            walletProvider,
            address
          );
          const userDetails = await tribute.getInfo();
          console.log(userDetails);
          setState(state => {
            return setState(
              ...state,
              { tribute },
              { userDetails },
            );
          });
        }
      } catch (error) {
        console.log('Web3 Loading Error: ', error.message);
      }
    }
  }
  return (
    <div>
      {JSON.stringify(userDetails)}
    </div>
  );
}
```

## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FSend-Tribute%2Ftribute-utils.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FSend-Tribute%2Ftribute-utils?ref=badge_large)
