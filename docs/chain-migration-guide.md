# EnergyFi — Chain Migration Guide

AvaCloud에서 새 L1 체인을 생성한 뒤, 전체 스택을 새 체인에 연결하는 절차.

## Checklist

### 1. 루트 `.env` 수정 (수동)

```
ENERGYFI_L1_TESTNET_RPC=<새 RPC URL>
ENERGYFI_L1_TESTNET_CHAIN_ID=<새 Chain ID>
```

`hardhat.config.ts`가 이 값을 읽어 `energyfi-l1-testnet` 네트워크를 구성한다.

### 2. 컨트랙트 배포

```bash
cd contracts
npm run compile
npm run deploy:surface:testnet
```

- `deploy:surface:testnet`은 내부에서 `deployEssentialSurface()`를 먼저 실행한 뒤 Demo surface를 추가 배포한다.
- 완료 시 `contracts/deployments.json`이 자동 갱신된다.
- 배포 후 출력되는 컨트랙트 주소를 기록한다.

### 3. 루트 `.env` 컨트랙트 주소 업데이트 (수동)

배포된 주소를 루트 `.env`의 `*_ADDRESS` 항목에 반영한다.

### 4. 시더 실행

```bash
npm run seed:demo:testnet
```

- RegionSTO 배포 직후 RPC 동기화 지연(~90초)으로 실패할 수 있다. 재실행하면 이미 배포된 STO를 재사용한다.

### 5. 모바일 환경 업데이트

#### 5a. `mobile/.env`

시더 완료 시 출력되는 `EXPO_PUBLIC_*` 값을 복사한다.

#### 5b. `mobile/constants/contracts.ts` fallback 값

`.env` 없이 빌드될 때 사용되는 기본값을 교체한다. Chain ID fallback도 포함.

#### 5c. Vercel Environment Variables

**Vercel은 `mobile/.env`를 빌드에 사용하지 않는다.** Vercel 프로젝트 설정의 Environment Variables를 별도로 갱신해야 한다.

```bash
# 반드시 printf를 사용한다. echo는 trailing newline을 추가하여
# viem이 "Address is invalid" 에러를 발생시킨다.
vercel env rm EXPO_PUBLIC_ENERGYFI_CHAIN_ID production --yes
printf '%s' '59823' | vercel env add EXPO_PUBLIC_ENERGYFI_CHAIN_ID production
```

모든 `EXPO_PUBLIC_*` 변수에 대해 반복한다.

#### 5d. `mobile/vercel.json` RPC proxy destination

```json
{ "source": "/rpc", "destination": "https://subnets.avax.network/<slug>/testnet/rpc" }
```

### 6. 하드코딩 주소가 있는 파일 업데이트

| 파일 | 내용 |
|:---|:---|
| `docs/contract-deployment-links.md` | 주소 + 익스플로러 URL |
| `docs/judge-quick-start.md` | curl 예시의 RPC + 주소 |
| `contracts/scripts/verify/judge-demo.ts` | RPC, Chain ID, 주소, 익스플로러 URL |
| `README.md` | Chain ID, RPC, 익스플로러 URL |
| `mobile/scripts/serve-demo-web.mjs` | RPC fallback URL |

잔여 확인:
```bash
grep -r 'subnets.avax.network/<이전slug>' --include='*.ts' --include='*.md' --include='*.json' --include='*.mjs' .
```

### 7. Vercel 재배포

```bash
cd mobile
npx vercel --prod --force
```

`--force`는 빌드 캐시를 무시한다. env 변경 후 반드시 사용한다.

### 8. 검증

| 단계 | 방법 |
|:---|:---|
| 온체인 데이터 | `curl -s -X POST <RPC> -H 'content-type: application/json' --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'` |
| 로컬 웹 | `npm run build:web && node scripts/serve-demo-web.mjs` → http://127.0.0.1:8090 |
| Vercel 배포 | 번들 해시가 로컬과 동일한지 확인. DevTools Console에서 에러 없는지 확인 |

---

## Gotchas

### Vercel env에 `echo` 사용 금지

```bash
# BAD — trailing newline이 값에 포함됨
echo "0xAbCd..." | vercel env add EXPO_PUBLIC_FOO production

# GOOD — newline 없이 값만 전달
printf '%s' '0xAbCd...' | vercel env add EXPO_PUBLIC_FOO production
```

viem은 주소에 `\n`이 포함되면 `InvalidAddressError`를 발생시킨다.

### Vercel은 `mobile/.env`를 무시한다

Expo는 로컬에서 `.env`를 자동 로드하지만(`env: load .env`), Vercel 빌드 서버에서는 프로젝트 설정의 Environment Variables만 사용한다. `mobile/.env`를 수정해도 Vercel 배포에는 반영되지 않는다.

### 시더 RPC 동기화 지연

새 체인에서 RegionSTO를 처음 배포하면 RPC 노드 동기화에 시간이 걸린다. 시더가 실패하면 1-2분 후 재실행한다. 이미 배포된 컨트랙트는 idempotent하게 재사용된다.

### `deploy:surface:testnet`은 `essential`을 포함한다

`surface.ts`가 내부에서 `deployEssentialSurface()`를 호출하므로, `essential`을 따로 실행할 필요 없다.
