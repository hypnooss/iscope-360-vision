

## Fix: Pin urllib3 < 2.0 no requirements.txt

Alterar `python-agent/requirements.txt` linha 8 de `urllib3>=2.0.0` para `urllib3>=1.26.0,<2.0.0` para compatibilidade com OpenSSL 1.0.2 (CentOS 7).

### Arquivo
- `python-agent/requirements.txt` — linha 8

